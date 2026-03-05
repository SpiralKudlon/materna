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

/**
 * Pending sync item — stores POST requests that failed due to offline.
 * Replayed automatically when connectivity returns.
 */
export interface PendingSyncItem {
    id?: number;
    /** Target endpoint URL (relative or absolute) */
    url: string;
    /** HTTP method — always POST for ANC visits */
    method: 'POST';
    /** Serialised JSON body */
    body: string;
    /** Headers to replay (content-type, auth) */
    headers: Record<string, string>;
    /** Number of replay attempts so far */
    attempts: number;
    /** 'pending' → 'syncing' → deleted on success, or back to 'pending' on failure */
    status: 'pending' | 'syncing';
    createdAt: number;
}

export class PatientDB extends Dexie {
    outbox!: Table<SyncQueueItem, number>;
    drafts!: Table<FormDraft, string>;
    pendingSync!: Table<PendingSyncItem, number>;

    constructor() {
        super('PatientDB');
        this.version(3).stores({
            outbox: '++id, status, createdAt',
            drafts: 'id',
            pendingSync: '++id, status, url, createdAt',
        });
    }
}

export const db = new PatientDB();
