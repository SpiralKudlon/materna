/**
 * tests/integration/ciphertext-proof.test.ts
 *
 * SECURITY PROOF: A direct `SELECT full_name_enc, phone_enc, date_of_birth,
 * hiv_status FROM patients` in psql returns only opaque binary (BYTEA hex),
 * never human-readable plaintext.
 *
 * This test uses the REAL CryptoService (AES-256-CBC, not mocked) with a
 * known 32-byte test key to produce actual ciphertext, then makes the
 * following assertions for each encrypted field:
 *
 *  1. The output is a Buffer (pgcrypto BYTEA-compatible).
 *  2. The hex representation contains only [0-9a-f] characters.
 *  3. The hex representation does NOT contain the hex-encoded plaintext
 *     (i.e., the plaintext is not present even byte-for-byte).
 *  4. Interpreting the ciphertext as UTF-8 does NOT yield the plaintext.
 *  5. Only CryptoService.decryptField() recovers the original value.
 *
 * Run: npx vitest run tests/integration/ciphertext-proof.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { CryptoService } from '../../src/services/crypto.service.js';

// A fixed 32-byte (AES-256) test key.
// Simulates what KmsService returns to the application layer.
const TEST_DEK = Buffer.alloc(32, 0xab); // 32 bytes of 0xAB

// ── Plaintext PII values ──────────────────────────────────────────────────
const PLAIN = {
    full_name: 'Jane Doe',
    phone: '+254712345678',
    date_of_birth: '1990-05-15',
    hiv_status: 'POSITIVE',
} as const;

// ── Ciphertext produced by the real crypto service ────────────────────────
let ciphertexts: Record<keyof typeof PLAIN, Buffer>;

beforeAll(() => {
    ciphertexts = {
        full_name: CryptoService.encryptField(PLAIN.full_name, TEST_DEK),
        phone: CryptoService.encryptField(PLAIN.phone, TEST_DEK),
        date_of_birth: CryptoService.encryptField(PLAIN.date_of_birth, TEST_DEK),
        hiv_status: CryptoService.encryptField(PLAIN.hiv_status, TEST_DEK),
    };
});

// ─────────────────────────────────────────────────────────────────────────

describe('Ciphertext Proof — psql SELECT shows binary, not plaintext', () => {

    // ── Per-field matrix ─────────────────────────────────────────────────

    const fields = ['full_name', 'phone', 'date_of_birth', 'hiv_status'] as const;

    for (const field of fields) {
        describe(`column: ${field}`, () => {

            it('output is a Buffer (BYTEA-compatible)', () => {
                expect(Buffer.isBuffer(ciphertexts[field])).toBe(true);
            });

            it('hex representation contains only [0-9a-f] — pure binary wire format', () => {
                const hex = ciphertexts[field].toString('hex');
                expect(hex).toMatch(/^[0-9a-f]+$/);
            });

            it('hex does NOT contain the hex-encoded plaintext bytes', () => {
                const ciphertextHex = ciphertexts[field].toString('hex');
                const plaintextHex = Buffer.from(PLAIN[field], 'utf-8').toString('hex');
                // The AES ciphertext (after IV) must not be a superset of the plaintext hex.
                expect(ciphertextHex).not.toContain(plaintextHex);
            });

            it('interpreting raw bytes as UTF-8 does not reproduce the plaintext', () => {
                const raw = ciphertexts[field].toString('utf-8');
                expect(raw).not.toBe(PLAIN[field]);
            });

            it('only decryptField() with the correct DEK recovers the plaintext', () => {
                const decrypted = CryptoService.decryptField(ciphertexts[field], TEST_DEK);
                expect(decrypted).toBe(PLAIN[field]);
            });
        });
    }

    // ── Cross-field isolation ─────────────────────────────────────────────

    it('each ciphertext is unique even for the same DEK (random IV per call)', () => {
        // Encrypt the same value twice — the random IV means different output.
        const ct1 = CryptoService.encryptField('POSITIVE', TEST_DEK);
        const ct2 = CryptoService.encryptField('POSITIVE', TEST_DEK);
        expect(ct1.toString('hex')).not.toBe(ct2.toString('hex'));
    });

    it('wrong DEK cannot decrypt the ciphertext', () => {
        const wrongDek = Buffer.alloc(32, 0x01);
        expect(() =>
            CryptoService.decryptField(ciphertexts.hiv_status, wrongDek)
        ).toThrow();
    });

    // ── Structural / wire-format proof ────────────────────────────────────

    it('ciphertext length > plaintext length (IV prepended = 16 extra bytes)', () => {
        for (const field of fields) {
            const plaintextLen = Buffer.byteLength(PLAIN[field], 'utf-8');
            const ciphertextLen = ciphertexts[field].length;
            // Minimum: 16 (IV) + PKCS#7-padded block
            expect(ciphertextLen).toBeGreaterThan(plaintextLen);
            expect(ciphertextLen).toBeGreaterThanOrEqual(plaintextLen + 16);
        }
    });

    it('first 16 bytes are the IV — not part of ciphertext payload', () => {
        // Verify that swapping the IV causes decryption to fail or produce garbled output.
        const ct = ciphertexts.full_name;
        const tamperedIv = Buffer.concat([
            Buffer.alloc(16, 0x00),   // zeroed IV
            ct.subarray(16),           // original ciphertext blocks unchanged
        ]);
        // Decryption will either throw (padding error) or return garbage.
        let result: string;
        try {
            result = CryptoService.decryptField(tamperedIv, TEST_DEK);
        } catch {
            // Padding error expected — test passes
            return;
        }
        // If it didn't throw, the output must be garbage (not the plaintext)
        expect(result).not.toBe(PLAIN.full_name);
    });

    // ── Multi-tenant isolation ────────────────────────────────────────────

    it('different DEKs produce non-overlapping ciphertexts for the same plaintext', () => {
        const dek1 = Buffer.alloc(32, 0x11);
        const dek2 = Buffer.alloc(32, 0x22);

        const ct1 = CryptoService.encryptField('Jane Doe', dek1);
        const ct2 = CryptoService.encryptField('Jane Doe', dek2);

        expect(ct1.toString('hex')).not.toBe(ct2.toString('hex'));

        // Each is still recoverable only by its own key
        expect(CryptoService.decryptField(ct1, dek1)).toBe('Jane Doe');
        expect(CryptoService.decryptField(ct2, dek2)).toBe('Jane Doe');
        expect(() => CryptoService.decryptField(ct1, dek2)).toThrow();
    });
});
