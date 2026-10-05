import Redis from "ioredis";
let redis;
export function redisClient() {
  if (!process.env.REDIS_URL) return null;
  return (redis ||= new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
  }));
}
const local = new Map();
export async function cached(key, seconds, fn) {
  const r = redisClient();
  if (r) {
    try {
      if (r.status === "wait") await r.connect();
      const v = await r.get(key);
      if (v) return JSON.parse(v);
    } catch {}
  } else {
    const old = local.get(key);
    if (old && old.expires > Date.now()) return old.value;
  }
  const value = await fn();
  if (r) {
    try {
      await r.set(key, JSON.stringify(value), "EX", seconds);
    } catch {}
  } else {
    if (local.size > 500) local.delete(local.keys().next().value);
    local.set(key, { value, expires: Date.now() + seconds * 1000 });
  }
  return value;
}
