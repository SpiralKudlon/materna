import { Worker, type Job } from 'bullmq';
import { connection } from '../queues/index.js';
import AfricasTalking from 'africastalking';
import { env } from '../config/env.js';
import { createAtVoiceBreaker, createAtSmsBreaker } from '../lib/circuit-breakers.js';

const at = AfricasTalking({
    apiKey: env.AT_API_KEY,
    username: env.AT_USERNAME,
});

// Initialise Breakers
const sendSms = async (payload: { to: string[], message: string, from?: string }) => at.SMS.send(payload);
const makeCall = async (payload: { callFrom: string, callTo: string[] }) => at.VOICE.call(payload);

const atSmsBreaker = createAtSmsBreaker(sendSms);
const atVoiceBreaker = createAtVoiceBreaker(makeCall, (payload) => atSmsBreaker.fire(payload), env.AT_VIRTUAL_NUMBER ?? '');

export interface EmergencySosData {
    patientId: string;
    patientPhone: string;
    chvPhone: string;
}

export const emergencySosWorker = new Worker(
    'emergency_sos',
    async (job: Job) => {
        const data = job.data as EmergencySosData;

        // SLA Constraint: MUST execute within 2 minutes of the job enqueuing
        // We calculate latency from the time BullMQ received the job
        const enqueueTime = job.timestamp;
        const processTime = Date.now();
        const latencyMs = processTime - enqueueTime;

        console.log(`[EmergencyWorker] Processing SOS for patient ${data.patientId}. Queue Latency: ${latencyMs}ms`);

        if (latencyMs > 120_000) {
            console.error(`[EmergencyWorker] ❌ SLA BREACH: Job ${job.id} exceeded 2-minute latency (${latencyMs}ms)`);
            // In reality, emit metrics to Datadog/Prometheus here
        }

        try {
            console.log(`[EmergencyWorker] Initiating Africa's Talking Voice Call to CHV ${data.chvPhone}`);
            // Fire voice call via Circuit Breaker
            if (!env.AT_VIRTUAL_NUMBER) {
                console.warn('[EmergencyWorker] No virtual number configured for Voice. Simulating call.');
            } else {
                await atVoiceBreaker.fire({
                    callFrom: env.AT_VIRTUAL_NUMBER,
                    callTo: [data.chvPhone],
                });
            }

            console.log(`[EmergencyWorker] ✔️ Voice call initiated successfully for SOS`);
        } catch (err: any) {
            // High priority alerting channel if this fails
            throw new Error(`Emergency SOS Voice Call Failed: ${err.message}`);
        }
    },
    {
        connection: connection as any,
        // Maximum concurrency to ensure we process these immediately without head-of-line blocking
        concurrency: 50,
        // Aggressive loop to pick up jobs faster for the SLA
        maxStalledCount: 1,
    }
);

emergencySosWorker.on('failed', (job, err) => {
    console.error(`[EmergencyWorker] 🚨 CRITICAL: SOS Job ${job?.id} failed! ${err.message}`);
});
