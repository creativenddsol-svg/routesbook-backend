// testRedis.js
import redis from "./config/redisClient.js";

await redis.set("testkey", "hello world");
const value = await redis.get("testkey");
console.log("Value from Redis:", value);
