import { ApiClient } from '../api/client';

import { DetailedSymptomLog, DetailedSymptomLogSchema } from '../../../packages/shared-types';

export interface SymptomLogPayload extends DetailedSymptomLog {}

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
