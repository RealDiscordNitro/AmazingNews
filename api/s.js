import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).send("");
    
    try {
        const sub = req.body;
        const packedData = `${sub.endpoint}|${sub.keys.p256dh}|${sub.keys.auth}`;
        await redis.sadd("subs", packedData);
        res.status(200).json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
