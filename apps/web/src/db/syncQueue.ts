/**
 * syncQueue.ts — Offline sync queue service.
 *
 * Provides functions to:
 *   1. Enqueue a failed POST request into IndexedDB (pendingSync)
 *   2. Replay all pending requests when connectivity is restored
 *   3. Expose a count of pending items (for UI badges)
 *
 * Used by both the React hook (useSyncQueue) and the Service Worker.
 */
import { db, type PendingSyncItem } from './db';

const MAX_ATTEMPTS = 5;

/**
 * Enqueue a POST request for later replay.
 * Called when a fetch to /anc-visits (or similar) fails due to offline.
 */
export async function enqueueRequest(
    url: string,
    body: string,
    headers: Record<string, string> = {},
): Promise<number> {
    const id = await db.pendingSync.add({
        url,
        method: 'POST',
        body,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        attempts: 0,
        status: 'pending',
        createdAt: Date.now(),
    });
    return id;
}

/**
 * Replay all pending sync items.
 * Returns { synced, failed } counts.
 */
export async function replayPendingRequests(): Promise<{
    synced: number;
    failed: number;
    items: PendingSyncItem[];
}> {
    const pending = await db.pendingSync
        .where('status')
        .equals('pending')
        .toArray();

    let synced = 0;
    let failed = 0;
    const syncedItems: PendingSyncItem[] = [];

    for (const item of pending) {
        if (!item.id) continue;

        // Mark as syncing
        await db.pendingSync.update(item.id, { status: 'syncing' });

        try {
            const response = await fetch(item.url, {
                method: item.method,
                headers: item.headers,
                body: item.body,
            });

            if (response.ok) {
                // Success — remove from queue
                await db.pendingSync.delete(item.id);
                syncedItems.push(item);
                synced++;
            } else if (response.status >= 400 && response.status < 500) {
                // Client error — don't retry (bad data)
                await db.pendingSync.delete(item.id);
                failed++;
                console.warn(`Sync item ${item.id} returned ${response.status}, removing from queue`);
            } else {
                // Server error — revert to pending for retry
                const attempts = item.attempts + 1;
                if (attempts >= MAX_ATTEMPTS) {
                    await db.pendingSync.delete(item.id);
                    failed++;
                    console.error(`Sync item ${item.id} exceeded max attempts, removing`);
                } else {
                    await db.pendingSync.update(item.id, { status: 'pending', attempts });
                }
            }
        } catch {
            // Network error — revert to pending
            const attempts = item.attempts + 1;
            if (attempts >= MAX_ATTEMPTS) {
                await db.pendingSync.delete(item.id);
                failed++;
            } else {
                await db.pendingSync.update(item.id, { status: 'pending', attempts });
            }
        }
    }

    return { synced, failed, items: syncedItems };
}

/** Get the count of items waiting to sync. */
export async function getPendingCount(): Promise<number> {
    return db.pendingSync.where('status').equals('pending').count();
}
