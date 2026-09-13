// /api/extract.js
// Production extraction endpoint. Receives one worker's photos + one
// "chunk" of field definitions, and asks YOUR locally-hosted open-source
// model (via Ollama + a tunnel) to read the handwriting. Chunked into
// sections (not all 197 fields in one call) so each request finishes
// well within Vercel's function timeout, even on modest hardware.

const { callOllama } = require("./_ollama.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (req.headers["x-app-password"] !== process.env.APP_PASSWORD) {
    return res.status(403).json({ error: "Wrong or missing app password" });
  }

  const { images, chunk } = req.body || {};
  if (!images || !chunk) return res.status(400).json({ error: "Missing images or chunk" });

  const result = await callOllama(images, chunk.fields);
  return res.status(200).json(result);
};
