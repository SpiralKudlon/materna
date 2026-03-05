import Dexie, { type Table } from 'dexie';
import type { PatientRegistration } from '../schemas/patientSchema';

export interface SyncQueueItem {
    id?: number;
    data: PatientRegistration;
    status: 'pending' | 'syncing' | 'failed';
    createdAt: number;
}

/** Draft saved at every step so progress survives browser refresh. */
export interface FormDraft {
    id: string;           // fixed key, e.g. 'registration-draft'
    data: Partial<PatientRegistration>;
    currentStep: number;
    updatedAt: number;
}

export class PatientDB extends Dexie {
    outbox!: Table<SyncQueueItem, number>;
    drafts!: Table<FormDraft, string>;

    constructor() {
        super('PatientDB');
        this.version(2).stores({
            outbox: '++id, status, createdAt',
            drafts: 'id',
        });
    }
}

export const db = new PatientDB();
