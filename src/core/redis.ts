import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
  });

// Redis接続エラーを無視
redis.on('error', (err) => {
  console.warn('Redis connection error (ignored):', err.message);
});

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
