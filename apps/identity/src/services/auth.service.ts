import { userRepository } from '../repositories/user.repository.js';
import type { RegisterInput } from '../schemas/auth.schema.js';
import * as crypto from 'node:crypto';

export class AuthService {
    async register(input: RegisterInput) {
        const existing = await userRepository.findByEmail(input.email);
        if (existing) {
            throw new Error('User already exists');
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(input.password, salt, 1000, 64, 'sha512').toString('hex');

        const user = await userRepository.create({
            id: crypto.randomUUID(),
            email: input.email,
            name: input.name,
            passwordHash: `${salt}:${hash}`,
        });

        return {
            id: user.id,
            email: user.email,
            name: user.name,
        };
    }
}

export const authService = new AuthService();
