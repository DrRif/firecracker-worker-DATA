// /api/save-worker.js
const { redis } = require("./_upstash.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (req.headers["x-app-password"] !== process.env.APP_PASSWORD) {
    return res.status(403).json({ error: "Wrong or missing app password" });
  }

  const { id, data } = req.body || {};
  if (!id || !data) return res.status(400).json({ error: "Missing id or data" });

  try {
    await redis(["SET", `worker:${id}`, JSON.stringify(data)]);
    await redis(["SADD", "worker_ids", id]);
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};
