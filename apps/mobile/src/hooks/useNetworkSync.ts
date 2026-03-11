import { useEffect, useCallback } from 'react';
import * as Network from 'expo-network';
import { useSyncStore } from '../store/syncStore';
import { Alert } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export function useNetworkSync(jwtToken: string | null) {
  const { queue, dequeue, isSyncing, setSyncing } = useSyncStore();

  const processQueue = useCallback(async () => {
    // Prevent overlapping syncs, require a token, and skip if queue is empty
    if (isSyncing || queue.length === 0 || !jwtToken) return;

    // Check actual network connectivity before starting
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected || !networkState.isInternetReachable) return;

    setSyncing(true);
    let successCount = 0;

    try {
      // Process chronologically (oldest first)
      const sortedQueue = [...queue].sort((a, b) => a.timestamp - b.timestamp);

      for (const job of sortedQueue) {
        try {
          const response = await fetch(`${API_BASE_URL}${job.endpoint}`, {
            method: job.method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwtToken}`,
            },
            body: JSON.stringify(job.payload),
          });

          if (response.ok || response.status === 201) {
            dequeue(job.id);
            successCount++;
          } else if (response.status >= 400 && response.status < 500) {
            // Client error (e.g., 400 Bad Request) — drop it to prevent permanent blockage
            console.error(`[Sync] Job ${job.id} failed with ${response.status}. Dropping.`);
            dequeue(job.id);
          }
          // 5xx errors remain in the queue to retry later
        } catch (err) {
          console.warn(`[Sync] Network failed during job ${job.id}:`, err);
          break; // Stop processing this batch on network error
        }
      }
    } finally {
      setSyncing(false);
      if (successCount > 0) {
        console.log(`[Sync] Drained ${successCount} items from offline queue.`);
      }
    }
  }, [queue, isSyncing, jwtToken, dequeue, setSyncing]);

  // Hook into network state changes
  useEffect(() => {
    // 1. Drains queue automatically when the app boots if online
    processQueue();

    // 2. Poll network state periodically as a fallback to catch reconnects.
    // expo-network doesn't have a reliable event listener for *all* platforms yet,
    // so a gentle interval ensures we don't leave data stranded.
    const interval = setInterval(() => {
      processQueue();
    }, 15000); // Check every 15s

    return () => clearInterval(interval);
  }, [processQueue]);

  return { processQueue, pendingCount: queue.length };
}
