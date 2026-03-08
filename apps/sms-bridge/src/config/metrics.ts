import * as promClient from 'prom-client';

// Register standard Node.js metrics (CPU, Memory, Event Loop Lag, etc.)
promClient.collectDefaultMetrics({ prefix: 'sms_bridge_' });

// Create a custom counter for SMS deliveries
export const smsDeliveryTotal = new promClient.Counter({
    name: 'sms_delivery_total',
    help: 'Total number of SMS messages processed via webhooks',
    labelNames: ['provider', 'status'],
});

export const metricsRegistry = promClient.register;
