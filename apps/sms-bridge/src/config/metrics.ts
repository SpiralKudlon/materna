import * as promClient from 'prom-client';

// Register standard Node.js metrics (CPU, Memory, Event Loop Lag, etc.)
promClient.collectDefaultMetrics({ prefix: 'sms_bridge_' });

// Create a custom counter for SMS deliveries
export const smsDeliveryTotal = new promClient.Counter({
    name: 'sms_delivery_total',
    help: 'Total number of SMS messages processed via webhooks',
    labelNames: ['provider', 'status', 'channel'],
});

// Create USSD session completion tracking
export const ussdSessionCompletionsTotal = new promClient.Counter({
    name: 'ussd_session_completions_total',
    help: 'Total USSD sessions categorized by completion status',
    labelNames: ['status'],
});

// Create USSD duration histogram tracking "Log Symptom" workflows specifically
export const ussdSessionDurationSeconds = new promClient.Histogram({
    name: 'ussd_session_duration_seconds',
    help: 'Duration of USSD log symptom workflows in seconds',
    buckets: [5, 10, 20, 30, 60, 90, 120] // Targeted buckets for typing latency analytics
});

export const metricsRegistry = promClient.register;
