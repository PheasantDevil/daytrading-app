import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

// Redis接続のラッパークラス
class RedisWrapper {
  private redis: Redis | null = null;
  private isConnected = false;

  constructor() {
    try {
      this.redis = new Redis(
        process.env.REDIS_URL || 'redis://localhost:6379',
        {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
          connectTimeout: 5000,
          commandTimeout: 3000,
          retryDelayOnFailover: 100,
        }
      );

      this.redis.on('error', (err) => {
        console.warn('Redis connection error (ignored):', err.message);
        this.isConnected = false;
      });

      this.redis.on('connect', () => {
        this.isConnected = true;
      });

      this.redis.on('close', () => {
        this.isConnected = false;
      });
    } catch (error) {
      console.warn('Redis initialization failed:', error);
      this.redis = null;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.redis || !this.isConnected) {
      return null;
    }
    try {
      return await this.redis.get(key);
    } catch (error) {
      console.warn('Redis get error (ignored):', error);
      return null;
    }
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    if (!this.redis || !this.isConnected) {
      return;
    }
    try {
      await this.redis.setex(key, seconds, value);
    } catch (error) {
      console.warn('Redis setex error (ignored):', error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.redis || !this.isConnected) {
      return;
    }
    try {
      await this.redis.del(key);
    } catch (error) {
      console.warn('Redis del error (ignored):', error);
    }
  }
}

export const redis = globalForRedis.redis ?? new RedisWrapper();

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
