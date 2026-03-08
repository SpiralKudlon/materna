import { Worker, type Job } from 'bullmq';
import { connection } from '../queues/index.js';
import AfricasTalking from 'africastalking';
import { env } from '../config/env.js';

import * as admin from 'firebase-admin';

// Initialize Firebase Admin for FCM
if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
    console.log('Firebase Admin initialized');
} else {
    console.warn('Firebase Admin credentials missing. FCM pushes will be simulated.');
}

// Initialize Africa's Talking SDK for SMS
const at = AfricasTalking({
    apiKey: env.AT_API_KEY,
    username: env.AT_USERNAME,
});

export interface HighRiskAlertData {
    patientId: string;
    patientPhone: string;
    chvPhone: string; // Used as FCM proxy or SMS fallback for CHV
    chvFcmToken?: string;
    facilityId: string;
    riskScore: number;
    riskTier: 'HIGH';
    contributingFactors: any[];
}

export interface AncReminderData {
    patientId: string;
    patientPhone: string;
    visitDate: string;
    reminderType: 'T-72H' | 'T-24H';
}

export const notificationWorker = new Worker(
    'notifications',
    async (job: Job) => {
        console.log(`[NotificationWorker] Processing job ${job.id} of type ${job.name}`);

        if (job.name === 'HIGH_RISK_ALERT') {
            await processHighRiskAlert(job.data as HighRiskAlertData);
        } else if (job.name === 'ANC_REMINDER') {
            await processAncReminder(job.data as AncReminderData);
        } else {
            console.warn(`[NotificationWorker] Unknown job name: ${job.name}`);
        }
    },
    {
        connection,
        // Process up to 10 notifications concurrently
        concurrency: 10,
    }
);

async function processHighRiskAlert(data: HighRiskAlertData) {
    console.log(`🚨 Generating HIGH RISK alert for patient ${data.patientId}`);
    const message = `URGENT: Your recent assessment flagged a HIGH risk (Score: ${data.riskScore}). Please visit the clinic immediately or contact your CHV.`;

    try {
        // 1. Send SMS to Patient
        await at.SMS.send({
            to: [data.patientPhone],
            message,
            from: env.AT_VIRTUAL_NUMBER,
        });
        console.log(`[NotificationWorker] SMS sent to patient ${data.patientPhone}`);

        // 2. Trigger FCM Push to CHV
        if (data.chvFcmToken) {
            if (admin.apps.length > 0) {
                await admin.messaging().send({
                    token: data.chvFcmToken,
                    notification: {
                        title: 'High Risk Alert',
                        body: `Patient ${data.patientId} flagged as HIGH risk. Contact them immediately.`,
                    },
                    data: {
                        patientId: data.patientId,
                        riskScore: String(data.riskScore),
                    }
                });
                console.log(`[NotificationWorker] FCM Push sent to CHV token: ${data.chvFcmToken}`);
            } else {
                console.log(`[NotificationWorker] FCM Push simulated for CHV token: ${data.chvFcmToken} (admin not initialized)`);
            }
        } else {
            console.log(`[NotificationWorker] CHV has no FCM token. Sent SMS fallback to ${data.chvPhone}`);
            await at.SMS.send({
                to: [data.chvPhone],
                message: `ALERT: Patient ${data.patientId} flagged as HIGH risk. Contact them immediately.`,
                from: env.AT_VIRTUAL_NUMBER,
            });
        }

        // 3. Output log intended for Facility WebSocket/In-App
        console.log(`[NotificationWorker] [IN-APP-WS] Emitting facility alert to channel facility-${data.facilityId}`);
    } catch (err: any) {
        throw new Error(`High Risk Alert Failed: ${err.message}`);
    }
}

async function processAncReminder(data: AncReminderData) {
    console.log(`📅 Generating ANC Reminder (${data.reminderType}) for patient ${data.patientId}`);
    const msg = data.reminderType === 'T-72H'
        ? `Reminder: You have an upcoming ANC visit in 3 days on ${data.visitDate}.`
        : `Reminder: Your ANC visit is tomorrow, ${data.visitDate}. Please remember to attend.`;

    try {
        await at.SMS.send({
            to: [data.patientPhone],
            message: msg,
            from: env.AT_VIRTUAL_NUMBER,
        });
        console.log(`[NotificationWorker] SMS reminder sent to ${data.patientPhone}`);
    } catch (err: any) {
        throw new Error(`ANC Reminder Failed: ${err.message}`);
    }
}

notificationWorker.on('failed', (job, err) => {
    console.error(`[NotificationWorker] Job ${job?.id} failed with error ${err.message}`);
});
