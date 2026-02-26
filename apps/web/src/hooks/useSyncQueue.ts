import { useEffect, useState } from 'react';
import { db } from '../db/db';

export function useSyncQueue() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            syncPendingItems();
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial check on mount
        if (navigator.onLine) {
            syncPendingItems();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const syncPendingItems = async () => {
        if (syncing || !navigator.onLine) return;

        setSyncing(true);
        try {
            const pendingItems = await db.outbox.where('status').equals('pending').toArray();

            for (const item of pendingItems) {
                if (!item.id) continue;

                await db.outbox.update(item.id, { status: 'syncing' });

                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Remove on success
                await db.outbox.delete(item.id);
                console.log(`Successfully synced patient: ${item.data.personalDetails.fullName}`);
            }
        } catch (error) {
            console.error('Failed to sync queue', error);
            // Revert items back to pending if needed (skipped for simplicity here)
        } finally {
            setSyncing(false);
        }
    };

    return { isOnline, syncing, syncPendingItems };
}
