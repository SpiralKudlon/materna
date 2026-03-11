import * as Network from 'expo-network';
import { useSyncStore } from '../store/syncStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface SymptomLogPayload {
  patientId: string;
  symptoms: string[];
  notes?: string;
  temperature?: number;
  bloodPressureSys?: number;
  bloodPressureDia?: number;
}

export async function logSymptom(
  tenantId: string,
  payload: SymptomLogPayload,
  jwtToken: string
): Promise<{ status: 'sent' | 'queued' }> {
  const network = await Network.getNetworkStateAsync();

  if (network.isConnected && network.isInternetReachable) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/symptoms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
          'Authorization': `Bearer ${jwtToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok || response.status === 201) {
        return { status: 'sent' };
      }
      
      // If 5xx, we fall through to enqueueing it
      if (response.status < 500) {
        throw new Error(`Client Error: ${response.status}`);
      }
    } catch (err) {
      console.warn('[SymptomService] Direct send failed. Queuing for offline sync.', err);
    }
  }

  // Enqueue in Zustand / AsyncStorage queue
  useSyncStore.getState().enqueue({
    type: 'SYMPTOM_LOG',
    endpoint: '/api/v1/symptoms',
    method: 'POST',
    payload, // Assuming server accepts tenantId via context or we inject it into the queue header config later
  });

  return { status: 'queued' };
}
