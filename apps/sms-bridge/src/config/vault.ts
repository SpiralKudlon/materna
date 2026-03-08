import Vault from 'node-vault';
import { env } from './env.js';

export interface SmsSecrets {
    AT_API_KEY: string;
    AT_USERNAME: string;
    TWILIO_ACCOUNT_SID: string;
    TWILIO_AUTH_TOKEN: string;
    TWILIO_FROM_NUMBER: string;
}

const vault = Vault({
    apiVersion: 'v1',
    endpoint: env.VAULT_ADDR,
    token: env.VAULT_TOKEN,
});

/**
 * Fetches SMS provider secrets from HashiCorp Vault KV v2.
 * Throws if the path doesn't exist or secrets are missing.
 */
export async function getSmsSecrets(): Promise<SmsSecrets> {
    try {
        const result = await vault.read(env.VAULT_SECRET_PATH);
        const data = result.data.data; // KV v2 nests data under data.data

        const requiredKeys = [
            'AT_API_KEY',
            'AT_USERNAME',
            'TWILIO_ACCOUNT_SID',
            'TWILIO_AUTH_TOKEN',
            'TWILIO_FROM_NUMBER',
        ];

        for (const key of requiredKeys) {
            if (!data[key]) {
                throw new Error(`Missing required secret: ${key} in Vault path ${env.VAULT_SECRET_PATH}`);
            }
        }

        return data as SmsSecrets;
    } catch (err: any) {
        console.error('❌ Failed to fetch secrets from Vault:', err.message);
        throw err;
    }
}
