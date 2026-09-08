// /api/delete-worker.js
const { redis } = require("./_upstash.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (req.headers["x-app-password"] !== process.env.APP_PASSWORD) {
    return res.status(403).json({ error: "Wrong or missing app password" });
  }

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing id" });

  try {
    await redis(["DEL", `worker:${id}`]);
    await redis(["SREM", "worker_ids", id]);
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};
