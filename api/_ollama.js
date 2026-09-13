// /api/_ollama.js
// Calls a LOCAL open-source vision model (via Ollama, running on your own
// GPU machine) instead of a cloud AI provider. Your machine needs to be
// on, running Ollama with the model pulled, and reachable through a
// tunnel (ngrok/Cloudflare Tunnel) whose public URL is stored in the
// LOCAL_MODEL_URL environment variable.
//
// Chunked on purpose: each call handles one section of the form (not all
// 197 fields at once) so a single request finishes well within Vercel's
// 60-second function timeout, even on modest hardware.

const OLLAMA_MODEL = "qwen2.5vl:7b";

function assignCodes(fields) {
  return fields.map((f, i) => ({ ...f, code: `f${i + 1}` }));
}

function buildPrompt(codedFields) {
  const lines = codedFields.map((f) => {
    let opt = "";
    if (f.options) opt = ` | allowed values (choose exactly one, verbatim): ${JSON.stringify(f.options)}`;
    return `${f.code} = "${f.header}" (${f.kind})${opt}`;
  });
  return `These images are photographed pages of ONE handwritten paper questionnaire from a study on firecracker workers in Sivakasi. Below is a list of fields, each given a short code. Read all the images and extract every field.

${lines.join("\n")}

Rules:
- Return STRICT JSON only. No markdown, no code fences, no commentary, no explanation.
- Use ONLY the short codes above as JSON keys (e.g. "f1", "f2"...) — never the field names.
- Include every code listed above as a key, plus one extra key "_u": an array of codes you are genuinely unsure about. Use an empty array if nothing is uncertain.
- For a field with "allowed values", output one of those values verbatim.
- For free text or number fields, transcribe as plainly as possible.
- If a field is blank or illegible, output an empty string "" for it. Never omit a key. Never invent an answer.
- Keep every value as short as possible.
- Output nothing except the JSON object.`;
}

async function callOllama(images, fields) {
  const baseUrl = process.env.LOCAL_MODEL_URL;
  if (!baseUrl) {
    return { success: false, error: "LOCAL_MODEL_URL is not set — your GPU machine's tunnel URL needs to be added as an environment variable." };
  }

  const codedFields = assignCodes(fields);
  const codeToHeader = {};
  codedFields.forEach((f) => { codeToHeader[f.code] = f.header; });

  const prompt = buildPrompt(codedFields);
  const imageBase64s = images.map((img) => img.data); // Ollama wants raw base64 strings, no data-URL prefix

  try {
    const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: "user", content: prompt, images: imageBase64s }],
        stream: false,
        format: "json", // ask Ollama to constrain output to valid JSON
        options: {
          // Ollama's default context window (4096 tokens) is too small for
          // several photos at once. This raises it — but on an 8GB GPU,
          // going too high risks running out of memory instead, since the
          // model weights alone already use most of that 8GB. If you see
          // an out-of-memory error instead of the old "exceeds context
          // size" error, this number needs to come back down, not up.
          num_ctx: 12288,
        },
      }),
      // Vercel Hobby caps functions at 60s anyway, but guard against hanging forever
      signal: AbortSignal.timeout(55000),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return { success: false, error: `Local model server error: HTTP ${resp.status} ${text.slice(0, 150)}` };
    }

    const data = await resp.json();
    const raw = (data.message && data.message.content) || "";
    let cleaned = raw.trim();
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);

    let codedResult;
    try {
      codedResult = JSON.parse(cleaned);
    } catch (e) {
      return { success: false, error: `Couldn't parse JSON from local model. Raw start: "${raw.slice(0, 150)}"` };
    }

    const decoded = {};
    for (const [code, value] of Object.entries(codedResult)) {
      if (code === "_u") continue;
      const header = codeToHeader[code];
      if (header) decoded[header] = value;
    }
    decoded._uncertain = (codedResult._u || []).map((c) => codeToHeader[c]).filter(Boolean);

    return { success: true, data: decoded };
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      return { success: false, error: "Local model took too long to respond (over 55s) — it may be overloaded or your tunnel disconnected." };
    }
    return { success: false, error: `Couldn't reach your local model server: ${e.message}. Check your PC is on, Ollama is running, and the tunnel is active.` };
  }
}

module.exports = { callOllama };
