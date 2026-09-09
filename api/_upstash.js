// /api/_upstash.js
// Tiny helper for Upstash Redis's REST API — no npm package needed,
// just plain fetch calls. Each call sends one Redis command as a JSON array.
//
// Different Vercel integration flows inject different env var names for the
// same thing (UPSTASH_REDIS_REST_* vs the older KV_REST_API_* naming), so we
// accept either.

async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Redis environment variables are not set");

  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = await resp.json();
  if (data.error) throw new Error(`Upstash error: ${data.error}`);
  return data.result;
}

module.exports = { redis };
