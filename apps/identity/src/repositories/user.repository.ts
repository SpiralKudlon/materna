import * as crypto from 'node:crypto';

export interface User {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
}

export class UserRepository {
    private users: User[] = [];

    async findByEmail(email: string): Promise<User | undefined> {
        return this.users.find((u) => u.email === email);
    }

    async create(user: User): Promise<User> {
        this.users.push(user);
        return user;
    }

    async clear() {
        this.users = [];
    }
}

export const userRepository = new UserRepository();
