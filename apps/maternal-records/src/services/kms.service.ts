/**
 * kms.service.ts — AWS KMS Envelope Encryption
 *
 * Strategy (Envelope Encryption):
 *   1. generateDataKey()  → calls KMS GenerateDataKey to get a 256-bit plaintext
 *      DEK (used briefly in memory) and its encrypted form (the blob stored in
 *      the `kms_key_id` column as base64).  The plaintext DEK is used to encrypt
 *      PII fields via CryptoService, then discarded.
 *
 *   2. decryptDataKey(encryptedDekB64) → calls KMS Decrypt to unwrap the stored
 *      blob, recovering the plaintext DEK for decryption of PII fields.
 *
 * Test-mode fallback:
 *   When NODE_ENV=test OR KMS_KEY_ID is absent, the service operates with a
 *   local in-memory map so that unit/integration tests run without AWS creds.
 *
 * Wire format for `kms_key_id` column:
 *   Production  → base64( KMS-encrypted DEK ciphertext )  ≈ 200 chars
 *   Test mode   → "test-key-<8 hex chars>"  (synthetic key ID)
 */

import {
    KMSClient,
    GenerateDataKeyCommand,
    DecryptCommand,
} from '@aws-sdk/client-kms';
import { randomBytes } from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────

export interface KmsDataKey {
    /** 32-byte plaintext DEK — use in memory only, never persist. */
    plaintextDek: Buffer;
    /**
     * Production: base64-encoded KMS-encrypted DEK ciphertext.
     * Test mode:  synthetic key ID string.
     * Store this value in the `kms_key_id` DB column.
     */
    kmsKeyId: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isTestMode(): boolean {
    return (
        process.env.NODE_ENV === 'test' ||
        !process.env.KMS_KEY_ID
    );
}

// ── Production KMS client (lazy-initialised) ──────────────────────────────

let _kmsClient: KMSClient | null = null;

function getKmsClient(): KMSClient {
    if (!_kmsClient) {
        _kmsClient = new KMSClient({
            region: process.env.AWS_REGION ?? 'eu-west-1',
        });
    }
    return _kmsClient;
}

// ── Test-mode in-memory store ─────────────────────────────────────────────
// Only populated / read when isTestMode() === true.

const _testKeyStore = new Map<string, Buffer>();

// ── KmsService ────────────────────────────────────────────────────────────

export class KmsService {

    // ── generateDataKey ──────────────────────────────────────────────────

    /**
     * Generates a new 256-bit Data Encryption Key (DEK).
     *
     * Production:
     *   Calls `KMS:GenerateDataKey` against the CMK identified by `KMS_KEY_ID`.
     *   Returns the plaintext DEK for in-memory use and the corresponding
     *   KMS-encrypted DEK ciphertext (base64) for storage.
     *
     * Test mode:
     *   Returns a random 32-byte DEK and a synthetic key ID without any
     *   network call.
     */
    static async generateDataKey(): Promise<KmsDataKey> {
        if (isTestMode()) {
            return KmsService._testGenerateDataKey();
        }

        const client = getKmsClient();
        const cmd = new GenerateDataKeyCommand({
            KeyId: process.env.KMS_KEY_ID!,
            KeySpec: 'AES_256',
        });

        const response = await client.send(cmd);

        if (!response.Plaintext || !response.CiphertextBlob) {
            throw new Error('KMS GenerateDataKey returned incomplete response');
        }

        // Plaintext DEK — use immediately, never persist.
        const plaintextDek = Buffer.from(response.Plaintext);

        // Encrypted DEK — safe to store in the DB. Encode as base64 string
        // to fit in the VARCHAR(255) kms_key_id column.
        const kmsKeyId = Buffer.from(response.CiphertextBlob).toString('base64');

        return { plaintextDek, kmsKeyId };
    }

    // ── decryptDataKey ───────────────────────────────────────────────────

    /**
     * Unwraps a stored encrypted DEK back into a plaintext 32-byte key.
     *
     * @param kmsKeyId  The value stored in the `kms_key_id` DB column.
     *                  Production: base64 KMS ciphertext blob.
     *                  Test mode:  synthetic key ID string.
     */
    static async decryptDataKey(kmsKeyId: string): Promise<Buffer> {
        if (isTestMode()) {
            return KmsService._testDecryptDataKey(kmsKeyId);
        }

        const client = getKmsClient();
        const ciphertextBlob = Buffer.from(kmsKeyId, 'base64');

        const cmd = new DecryptCommand({ CiphertextBlob: ciphertextBlob });
        const response = await client.send(cmd);

        if (!response.Plaintext) {
            throw new Error(`KMS Decrypt returned no plaintext for key: ${kmsKeyId.slice(0, 20)}...`);
        }

        return Buffer.from(response.Plaintext);
    }

    // ── Test-mode helpers (private) ──────────────────────────────────────

    private static _testGenerateDataKey(): KmsDataKey {
        const plaintextDek = randomBytes(32);
        const kmsKeyId = `test-key-${randomBytes(4).toString('hex')}`;
        _testKeyStore.set(kmsKeyId, plaintextDek);
        return { plaintextDek, kmsKeyId };
    }

    private static _testDecryptDataKey(kmsKeyId: string): Buffer {
        const dek = _testKeyStore.get(kmsKeyId);
        if (!dek) {
            throw new Error(
                `[KMS test-mode] Key not found: "${kmsKeyId}". ` +
                'Ensure generateDataKey() was called before decryptDataKey() in the same process.',
            );
        }
        return dek;
    }

    /**
     * Resets the test-mode key store.
     * Only for use in test scaffolding — no-op in production.
     */
    static _testReset(): void {
        if (isTestMode()) _testKeyStore.clear();
    }
}
