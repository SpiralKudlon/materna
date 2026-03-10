/**
 * crypto.service.ts
 *
 * Implements AES-256-CBC field-level encryption. The DEK (Data Encryption Key)
 * is fetched dynamically via the `KmsService`.
 *
 * Algorithm: aes-256-cbc
 * IV: 16 random bytes prepended to the ciphertext buffer for deterministic extraction.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

export class CryptoService {
    /**
     * Encrypts a plaintext string into a Buffer containing the IV + Ciphertext.
     * @param plaintext The clinical data or PII (e.g. "POSITIVE", "2000-01-01").
     * @param dek The 32-byte Data Encryption Key from AWS KMS.
     * @returns A Buffer safe for saving into a PostgreSQL BYTEA column.
     */
    static encryptField(plaintext: string, dek: Buffer): Buffer {
        // Assert DEK is exactly 256 bits
        if (dek.length !== 32) {
            throw new Error('Encryption requires a 256-bit (32-byte) DEK');
        }

        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv(ALGORITHM, dek, iv);

        const encrypted = Buffer.concat([
            cipher.update(plaintext, 'utf-8'),
            cipher.final()
        ]);

        // Prepend the IV so the decryption phase can extract it dynamically.
        return Buffer.concat([iv, encrypted]);
    }

    /**
     * Decrypts a previously encrypted Buffer back to a plaintext string.
     * @param encryptedBuffer The IV + Ciphertext fetched from PostgreSQL BYTEA.
     * @param dek The 32-byte Data Encryption Key resolved via KMS.
     */
    static decryptField(encryptedBuffer: Buffer, dek: Buffer): string {
        if (dek.length !== 32) {
            throw new Error('Decryption requires a 256-bit (32-byte) DEK');
        }
        if (encryptedBuffer.length <= IV_LENGTH) {
            throw new Error('Malformed encrypted buffer (too short to contain IV)');
        }

        // Extract the leading 16-byte IV
        const iv = encryptedBuffer.subarray(0, IV_LENGTH);
        const ciphertext = encryptedBuffer.subarray(IV_LENGTH);

        const decipher = createDecipheriv(ALGORITHM, dek, iv);

        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final()
        ]);

        return decrypted.toString('utf-8');
    }
}
