/**
 * sms.service.ts — Africa's Talking SMS gateway wrapper.
 *
 * In test/development mode, messages are logged to console instead of
 * being sent via the real API.
 */

export interface SmsGateway {
    send(to: string, message: string): Promise<void>;
}

export class AfricasTalkingSmsService implements SmsGateway {
    private readonly sms: { send: (opts: { to: string[]; message: string; from?: string }) => Promise<unknown> };

    constructor(
        apiKey: string,
        username: string,
        private readonly senderId?: string,
    ) {
        // Africa's Talking SDK uses CommonJS; we import it dynamically
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const AfricasTalking = require('africastalking');
        const client = AfricasTalking({ apiKey, username });
        this.sms = client.SMS;
    }

    async send(to: string, message: string): Promise<void> {
        await this.sms.send({
            to: [to],
            message,
            ...(this.senderId ? { from: this.senderId } : {}),
        });
    }
}

/**
 * Console-based stub for test and development environments.
 */
export class ConsoleSmsService implements SmsGateway {
    public lastMessage: { to: string; message: string } | null = null;

    async send(to: string, message: string): Promise<void> {
        this.lastMessage = { to, message };
        console.info(`[SMS STUB] → ${to}: ${message}`);
    }
}
