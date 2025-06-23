import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

class RedisManager {
  private client: RedisClientType;
  private static instance: RedisManager;

  private constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      },
    });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error', err);
    });

    this.client.on('connect', () => {
      logger.info('Redis Client Connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis Client Ready');
    });

    this.client.on('end', () => {
      logger.info('Redis Client Disconnected');
    });
  }

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  public getClient(): RedisClientType {
    return this.client;
  }

  public async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.disconnect();
    }
  }

  // Cache operations
  public async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  public async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  public async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  public async exists(key: string): Promise<number> {
    return await this.client.exists(key);
  }

  // Hash operations
  public async hSet(key: string, field: string, value: string): Promise<number> {
    return await this.client.hSet(key, field, value);
  }

  public async hGet(key: string, field: string): Promise<string | undefined> {
    return await this.client.hGet(key, field);
  }

  public async hGetAll(key: string): Promise<Record<string, string>> {
    return await this.client.hGetAll(key);
  }

  // List operations
  public async lPush(key: string, ...values: string[]): Promise<number> {
    return await this.client.lPush(key, values);
  }

  public async rPop(key: string): Promise<string | null> {
    return await this.client.rPop(key);
  }

  // Set operations
  public async sAdd(key: string, ...members: string[]): Promise<number> {
    return await this.client.sAdd(key, members);
  }

  public async sMembers(key: string): Promise<string[]> {
    return await this.client.sMembers(key);
  }

  // Pub/Sub operations
  public async publish(channel: string, message: string): Promise<number> {
    return await this.client.publish(channel, message);
  }

  public async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.connect();
    await subscriber.subscribe(channel, callback);
  }

  // Utility methods
  public async flushAll(): Promise<string> {
    return await this.client.flushAll();
  }

  public async ping(): Promise<string> {
    return await this.client.ping();
  }
}

export const redis = RedisManager.getInstance();

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
    const pong = await redis.ping();
    logger.info('✅ Redis connected successfully', { response: pong });
  } catch (error) {
    logger.error('❌ Failed to connect to Redis', error);
    throw error;
  }
}

export { RedisManager };

