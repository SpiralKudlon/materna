import AfricasTalking from 'africastalking';
import twilio from 'twilio';
import type { SmsSecrets } from '../config/vault.js';

export interface SendResult {
    messageId: string;
    provider: 'AfricasTalking' | 'Twilio';
    status: string; // e.g. "Sent", "Queued"
}

export interface ISmsProvider {
    readonly name: 'AfricasTalking' | 'Twilio';
    send(to: string, message: string): Promise<SendResult>;
}

export class AfricasTalkingProvider implements ISmsProvider {
    public readonly name = 'AfricasTalking';
    private sms: any;
    private senderId?: string;

    constructor(secrets: SmsSecrets) {
        // Africa's Talking SDK initialization
        const at = AfricasTalking({
            apiKey: secrets.AT_API_KEY,
            username: secrets.AT_USERNAME,
        });
        this.sms = at.SMS;
        // Optional sender ID if configured in AT dashboard
        this.senderId = process.env.AT_SENDER_ID;
    }

    async send(to: string, message: string): Promise<SendResult> {
        try {
            const options: any = {
                to: [to],
                message,
            };
            if (this.senderId) {
                options.from = this.senderId;
            }

            const response = await this.sms.send(options);

            // AT response format: { SMSMessageData: { Recipients: [{ messageId: '...', status: 'Success' }] } }
            const recipient = response.SMSMessageData.Recipients[0];

            if (recipient.status === 'Failed' || recipient.status === 'Rejected') {
                throw new Error(`AT API rejected message for ${to}: ${recipient.status}`);
            }

            return {
                messageId: recipient.messageId,
                provider: this.name,
                status: recipient.status,
            };
        } catch (error: any) {
            // Rethrow so the orchestrator can catch and trigger retries/fallback
            throw new Error(`Africa's Talking send failed: ${error.message}`);
        }
    }
}

export class TwilioProvider implements ISmsProvider {
    public readonly name = 'Twilio';
    private client: twilio.Twilio;
    private fromNumber: string;

    constructor(secrets: SmsSecrets) {
        this.client = twilio(secrets.TWILIO_ACCOUNT_SID, secrets.TWILIO_AUTH_TOKEN);
        this.fromNumber = secrets.TWILIO_FROM_NUMBER;
    }

    async send(to: string, message: string): Promise<SendResult> {
        try {
            const response = await this.client.messages.create({
                body: message,
                from: this.fromNumber,
                to: to,
            });

            return {
                messageId: response.sid,
                provider: this.name,
                status: response.status, // e.g. "queued", "sent"
            };
        } catch (error: any) {
            throw new Error(`Twilio send failed: ${error.message}`);
        }
    }
}
