import webpush from "web-push";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

webpush.setVapidDetails(
  "mailto:admin@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.headers.authorization !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Read custom parameters sent from admin prompts
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
