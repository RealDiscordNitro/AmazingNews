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
  const authHeader = req.headers.authorization || req.headers['Authorization'];

  if (!adminPassword || authHeader !== adminPassword) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // If the client sends a GET request, it's just checking the password (NO broadcast)
  if (req.method === "GET") {
    return res.status(200).json({ success: true, verified: true });
  }

  if (req.method !== "POST") return res.status(405).send("");

  try {
    const { title, body, icon, url } = req.body || {};

    const payload = JSON.stringify({
      title: title || "SYSTEM UPDATE",
      body: body || "New alert received.",
      icon: icon || "https://cdn-icons-png.flaticon.com/512/103/103086.png",
      url: url || "https://google.com"
    });

    const packedSubs = await redis.smembers("subs");

    for (const packed of packedSubs) {
      try {
        const [endpoint, p256dh, auth] = packed.split("|");
        const sub = { endpoint, keys: { p256dh, auth } };
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        if (err.statusCode === 410) {
          await redis.srem("subs", packed);
        }
      }
    }
    
    res.status(200).json({ success: true, count: packedSubs.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
