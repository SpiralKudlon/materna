import { ApiClient } from '../api/client';

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
  // ApiClient automatically handles network detection, 
  // immediate transmission, and 5xx/offline queue enqueuing.
  return await ApiClient.request('/api/v1/symptoms', {
    method: 'POST',
    body: payload,
    jwtToken,
    tenantId,
    syncType: 'SYMPTOM_LOG',
  });
}
