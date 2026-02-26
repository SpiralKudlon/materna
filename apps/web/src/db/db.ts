import Dexie, { type Table } from 'dexie';
import type { PatientRegistration } from '../schemas/patientSchema';

export interface SyncQueueItem {
    id?: number;
    data: PatientRegistration;
    status: 'pending' | 'syncing' | 'failed';
    createdAt: number;
}

export class PatientDB extends Dexie {
    outbox!: Table<SyncQueueItem, number>;

    constructor() {
        super('PatientDB');
        this.version(1).stores({
            outbox: '++id, status, createdAt',
        });
    }
}

export const db = new PatientDB();
