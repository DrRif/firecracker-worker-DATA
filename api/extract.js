// /api/extract.js
// Receives one worker's photos + one "chunk" of field definitions,
// asks Claude to read the handwriting, and returns parsed JSON.
// The Anthropic API key never reaches the browser — it stays in this
// server-side function, read from an environment variable.
//
// Note: Vercel's default request body limit (~4.5MB) applies here. The
// frontend downsizes photos before sending, but a worker with many large
// pages could still bump into this — see the README if uploads fail.

function buildPrompt(chunk) {
  const lines = chunk.fields.map((f) => {
    let opt = "";
    if (f.options) opt = ` | allowed values (choose exactly one, verbatim): ${JSON.stringify(f.options)}`;
    return `- "${f.header}" (${f.kind})${opt}`;
  });
  return `These images are photographed pages of ONE handwritten paper questionnaire from a study on firecracker workers in Sivakasi. Extract ONLY the following fields from what is written/circled/ticked in the images:

${lines.join("\n")}

Rules:
- Return STRICT JSON only. No markdown, no code fences, no commentary, no explanation.
- The JSON must be a single flat object whose keys are exactly the field names above, PLUS one extra key "_uncertain": an array of field names you are genuinely unsure about (illegible handwriting, ambiguous marks, or a page that seems missing). Use an empty array if nothing is uncertain.
- For a field with "allowed values", output one of those values verbatim.
- For free text or number fields, transcribe as plainly as possible (numbers as plain digits).
- If a field is blank or illegible, output an empty string "" for it. Never omit a key. Never invent an answer.
- Keep every value as short as possible — no explanations.
- Output nothing except the JSON object.`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (req.headers["x-app-password"] !== process.env.APP_PASSWORD) {
    return res.status(403).json({ error: "Wrong or missing app password" });
  }

  const { images, chunk } = req.body || {};
  if (!images || !chunk) return res.status(400).json({ error: "Missing images or chunk" });

  const content = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.media_type, data: img.data },
  }));
  content.push({ type: "text", text: buildPrompt(chunk) });

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content }],
      }),
    });
    const data = await resp.json();

    if (!resp.ok || data.type === "error") {
      const msg = data.error?.message || `HTTP ${resp.status}`;
      return res.status(200).json({ success: false, error: `API error: ${msg}` });
    }
    if (data.stop_reason === "max_tokens") {
      return res.status(200).json({ success: false, error: "Response was cut off (too long)." });
    }

    const raw = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    let cleaned = raw.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(200).json({
        success: false,
        error: `Couldn't parse the reply as JSON. Raw start: "${raw.slice(0, 150)}"`,
      });
    }

    return res.status(200).json({ success: true, data: parsed });
  } catch (e) {
    return res.status(200).json({ success: false, error: `Request failed: ${e.message}` });
  }
};

