import webpush from "web-push";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

webpush.setVapidDetails(
  "mailto:admin@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const authHeader = req.headers.authorization || req.headers['authorization'];

  if (!adminPassword || authHeader !== adminPassword) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // GET Requests (Admin Check / Raw Data)
  if (req.method === "GET") {
    if (req.query.action === 'raw') {
        const packedSubs = await redis.smembers("subs");
        return res.status(200).json({ success: true, count: packedSubs.length, data: packedSubs });
    }
    return res.status(200).json({ success: true, verified: true });
  }

  if (req.method !== "POST") return res.status(405).send("");

  // POST Requests (Broadcast / Flush)
  try {
    if (req.query.action === 'flush') {
        await redis.del("subs");
        return res.status(200).json({ success: true, message: "Database flushed." });
    }

    const { title, body, icon, url } = req.body || {};

    const payload = JSON.stringify({
      title: title || "SYSTEM UPDATE",
      body: body || "New alert received.",
      icon: icon || "https://cdn-icons-png.flaticon.com/512/103/103086.png",
      url: url || "https://google.com"
    });

    const packedSubs = await redis.smembers("subs");

    const pushPromises = packedSubs.map(async (packed) => {
      try {
        const [endpoint, p256dh, auth] = packed.split("|");
        const sub = { endpoint, keys: { p256dh, auth } };
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await redis.srem("subs", packed); 
        }
      }
    });

    await Promise.allSettled(pushPromises);
    res.status(200).json({ success: true, count: packedSubs.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
