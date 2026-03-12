import NetInfo from '@react-native-community/netinfo';
import { useSyncStore, SyncActionType } from '../store/syncStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  jwtToken?: string;
  tenantId?: string;
  syncType?: SyncActionType; // Used to identify the job if queued
}

export class ApiClient {
  /**
   * Unified request handler. If the device is online, attempts the request.
   * If offline or a server error (5xx) occurs during a mutation, it pushes the request into the offline queue.
   */
  static async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<{ data?: T; status: 'sent' | 'queued'; error?: string }> {
    const { method = 'GET', headers = {}, body, jwtToken, tenantId, syncType = 'SYMPTOM_LOG' } = options;
    
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };
    if (jwtToken) reqHeaders['Authorization'] = `Bearer ${jwtToken}`;
    if (tenantId) reqHeaders['x-tenant-id'] = tenantId;

    // Check actual network connectivity using NetInfo
    const netInfo = await NetInfo.fetch();

    if (netInfo.isConnected && netInfo.isInternetReachable !== false) {
      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method,
          headers: reqHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (response.ok || response.status === 201) {
          const data = response.status !== 204 ? await response.json() : undefined;
          return { data, status: 'sent' };
        }

        // 4xx errors are client errors—do not queue
        if (response.status >= 400 && response.status < 500) {
          return { status: 'sent', error: `Client Error: ${response.status}` };
        }
        
        console.warn(`[ApiClient] Server returned ${response.status}. Falling through to offline queue (if applicable).`);
      } catch (err: any) {
        console.warn(`[ApiClient] Fetch failed for ${endpoint}. Fallback to queue...`, err.message);
      }
    } else {
      console.log(`[ApiClient] Device offline. Unable to reach ${endpoint}.`);
    }

    // Offline or Network Error scenario (e.g. 5xx or fetch threw).
    // Only queue mutations (POST, PUT, PATCH, DELETE)
    if (method !== 'GET') {
      useSyncStore.getState().enqueue({
        type: syncType,
        endpoint,
        method,
        payload: body,
      });
      return { status: 'queued' };
    }

    return { status: 'sent', error: 'Device is offline. GET requests are not queued.' };
  }
}
