import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env.js';

// Shared Redis connection for BullMQ
export const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
});

// Queue for standard priority alerts and scheduled reminders
export const notificationsQueue = new Queue('notifications', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});

// Queue for high-priority emergency SOS calls (bypasses normal traffic)
export const emergencySosQueue = new Queue('emergency_sos', {
    connection,
    defaultJobOptions: {
        attempts: 2,
        backoff: {
            type: 'fixed',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});

console.log('📦 BullMQ Queues initialized');
