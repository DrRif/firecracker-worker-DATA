// /api/get-workers.js
const { redis } = require("./_upstash.js");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (req.headers["x-app-password"] !== process.env.APP_PASSWORD) {
    return res.status(403).json({ error: "Wrong or missing app password" });
  }

  try {
    const ids = (await redis(["SMEMBERS", "worker_ids"])) || [];
    const workers = [];
    for (const id of ids) {
      const raw = await redis(["GET", `worker:${id}`]);
      if (raw) {
        try {
          workers.push({ id, data: JSON.parse(raw) });
        } catch (_) {
          /* skip corrupted entry */
        }
      }
    }
    return res.status(200).json({ success: true, workers });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};
