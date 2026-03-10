/**
 * kms.service.ts
 *
 * Simulates connecting to AWS Key Management Service (KMS).
 * In a production architecture (Kenya Pilot), this connects via `aws-sdk`
 * to fetch a unique Data Encryption Key (DEK) wrapped by a Master Key (CMK).
 *
 * Field-Level Encryption Strategy (Envelope Encryption):
 * 1. App requests a DEK from AWS KMS.
 * 2. KMS returns a plaintext DEK (used briefly in memory) and the KMS Key ID.
 * 3. App encrypts the PII field using AES-256-CBC and the plaintext DEK.
 * 4. App stores the Ciphertext + KMS Key ID in Postgres.
 * 5. Text DEK is discarded from memory.
 */

import { randomBytes } from 'crypto';

export interface KmsDataKey {
    plaintextDek: Buffer;
    kmsKeyId: string;
}

export class KmsService {
    // Simulated remote AWS CMK storage.
    // In reality, KMS handles the mapping of Key ID -> Ciphertext DEK.
    private static mockMasterKeys = new Map<string, Buffer>();

    /**
     * Generates a new Data Encryption Key (DEK).
     * @returns The dynamically generated 32-byte DEK and its mock KMS Key ID.
     */
    static async generateDataKey(): Promise<KmsDataKey> {
        // 1. Generate a mock KMS Master Key ID.
        // In reality, this is the ARN of your managed AWS CMK.
        const kmsKeyId = `arn:aws:kms:eu-west-1:123456789012:key/${randomBytes(4).toString('hex')}`;

        // 2. Generate the 256-bit (32 byte) plaintext DEK.
        const plaintextDek = randomBytes(32);

        // Store it so we can 'decrypt' later for validation tests.
        this.mockMasterKeys.set(kmsKeyId, plaintextDek);

        return { plaintextDek, kmsKeyId };
    }

    /**
     * Resolves a stored KMS Key ID back to its plaintext Data Encryption Key.
     */
    static async decryptDataKey(kmsKeyId: string): Promise<Buffer> {
        const dek = this.mockMasterKeys.get(kmsKeyId);
        if (!dek) {
            throw new Error(`KMS Error: Requested Master Key ${kmsKeyId} not found or inaccessible.`);
        }
        return dek;
    }
}
