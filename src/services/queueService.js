import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let redisConnection = null;
let notificationQueue = null;
let useBullMQ = false;

// Array fallback for in-memory queue
const inMemoryQueue = [];
let fallbackInterval = null;

// Initialize Queue connection
try {
  redisConnection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 2000 // Quick timeout to failover fast
  });

  redisConnection.on('error', (err) => {
    if (!useBullMQ) {
      console.log('Redis is not running. Activating resilient in-memory local queue...');
      activateInMemoryFallback();
    }
  });

  redisConnection.on('connect', () => {
    if (!useBullMQ) {
      console.log('Successfully connected to Redis. Initializing BullMQ engine...');
      initBullMQ();
    }
  });
} catch (error) {
  console.log('Failed to initialize Redis client. Falling back to in-memory queue:', error.message);
  activateInMemoryFallback();
}

/**
 * Initializes BullMQ queue and worker
 */
function initBullMQ() {
  useBullMQ = true;
  notificationQueue = new Queue('notifications', { connection: redisConnection });

  // Initialize Worker to process jobs
  const worker = new Worker(
    'notifications',
    async (job) => {
      console.log(`[BullMQ Worker] Processing notification job ${job.id}`);
      const { processNotification } = await import('./notificationService.js');
      await processNotification(job.data);
    },
    {
      connection: redisConnection,
      concurrency: 5
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ Worker] Job ${job.id} failed:`, err.message);
  });
}

/**
 * Activates in-memory local fallback queue processor
 */
function activateInMemoryFallback() {
  useBullMQ = false;
  
  if (fallbackInterval) clearInterval(fallbackInterval);
  
  fallbackInterval = setInterval(async () => {
    if (inMemoryQueue.length === 0) return;
    
    const job = inMemoryQueue.shift();
    console.log(`[InMemory Queue] Processing local job: ${job.title}`);
    
    try {
      const { processNotification } = await import('./notificationService.js');
      await processNotification(job);
    } catch (err) {
      console.error('[InMemory Queue] Local job processing failed:', err.message);
      
      // Basic retry policy with counter
      job.retries = (job.retries || 0) + 1;
      if (job.retries <= 3) {
        console.log(`[InMemory Queue] Re-queueing job ${job.title} (Retry ${job.retries}/3)`);
        inMemoryQueue.push(job);
      } else {
        console.error(`[InMemory Queue] Job ${job.title} reached max retries. Moving to local DLQ.`);
      }
    }
  }, 1000); // Process one job every second
}

/**
 * Pushes a notification job to the queue
 * @param {object} jobData - Notification parameters
 */
export const addNotificationJob = async (jobData) => {
  if (useBullMQ && notificationQueue) {
    try {
      await notificationQueue.add(`notify_${Date.now()}`, jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      });
      console.log(`[Queue] Queued notification via BullMQ: ${jobData.title}`);
    } catch (err) {
      console.error('[Queue] BullMQ push failed, saving to memory fallback:', err.message);
      inMemoryQueue.push(jobData);
    }
  } else {
    console.log(`[Queue] Saved notification to Memory Queue: ${jobData.title}`);
    inMemoryQueue.push(jobData);
  }
};
