import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    connectTimeout: 1000,
    commandTimeout: 1000,
  });

// Redis接続エラーを無視
redis.on('error', (err) => {
  console.warn('Redis connection error (ignored):', err.message);
});

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
