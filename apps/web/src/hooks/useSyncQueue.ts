import { useEffect, useState, useCallback } from 'react';
import { db } from '../db/db';

export function useSyncQueue() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [syncing, setSyncing] = useState(false);

    // 🔴 Fix: useCallback so `syncPendingItems` is stable and the useEffect dependency
    //         array can reference it without stale-closure issues.
    const syncPendingItems = useCallback(async () => {
        if (!navigator.onLine) return;

        setSyncing(prev => {
            // Prevent re-entrant syncs; we read from prev to avoid stale state
            if (prev) return prev;
            return true;
        });

        // Abort if already syncing (setSyncing callback above returned prev=true)
        if (syncing) return;

        try {
            const pendingItems = await db.outbox.where('status').equals('pending').toArray();

            for (const item of pendingItems) {
                if (!item.id) continue;

                await db.outbox.update(item.id, { status: 'syncing' });

                try {
                    // TODO: Replace with real API call, e.g.:
                    // await apiClient.post('/patients', item.data);
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    await db.outbox.delete(item.id);
                    console.info(`Synced patient: ${item.data.personalDetails.fullName}`);
                } catch (itemError) {
                    // 🔴 Fix: Revert individual item back to 'pending' so it is retried next time
                    await db.outbox.update(item.id, { status: 'pending' });
                    console.error(`Failed to sync item ${item.id}, reverted to pending`, itemError);
                }
            }
        } catch (error) {
            console.error('Failed to read sync queue', error);
        } finally {
            setSyncing(false);
        }
    }, [syncing]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            syncPendingItems();
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        if (navigator.onLine) {
            syncPendingItems();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [syncPendingItems]);

    return { isOnline, syncing, syncPendingItems };
}
