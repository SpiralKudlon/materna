import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiClient } from '../api/client';
import { PatientProfile } from './profile';

const DASHBOARD_CACHE_KEY = '@chv_dashboard_patients';

export interface DashboardPatient extends PatientProfile {
  riskTier: 'LOW' | 'MODERATE' | 'HIGH';
  nextAncDate?: string; // YYYY-MM-DD
}

/**
 * Implements Stale-While-Revalidate (SWR) for the CHV Dashboard.
 * 
 * 1. Synchronously returns `cachedData` from AsyncStorage immediately on mount (if available).
 * 2. Asynchronously issues a background `ApiClient` fetch for the freshest data.
 * 3. On background success, updates the cache to disk and triggers `onSuccess` with the fresh data.
 */
export async function useAssignedPatientsSWR(
  tenantId: string,
  jwtToken: string,
  onStaleData: (staleData: DashboardPatient[]) => void,
  onFreshData: (freshData: DashboardPatient[]) => void,
  onError: (cacheExisted: boolean) => void
) {
  let hasCache = false;
  
  // 1. STALE: Read offline disk immediately
  try {
    const cachedItem = await AsyncStorage.getItem(DASHBOARD_CACHE_KEY);
    if (cachedItem) {
      const parsed = JSON.parse(cachedItem) as DashboardPatient[];
      hasCache = true;
      onStaleData(parsed);
    }
  } catch (err) {
    console.error('[Dashboard] Error reading SWR cache:', err);
  }

  // 2. REVALIDATE: Fetch network silently. 
  // ApiClient bypasses queueing for GET requests, simply failing over.
  const { data: freshPatients, status } = await ApiClient.request<DashboardPatient[]>('/api/v1/dashboard/assigned', {
    method: 'GET',
    jwtToken,
    tenantId,
  });

  if (status === 'sent' && freshPatients) {
    // 3. FRESH: Update UI and rewrite disk cache
    onFreshData(freshPatients);
    AsyncStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(freshPatients)).catch(e => console.error('[Dashboard] Cache write error:', e));
  } else {
    // 4. OFFLINE / TIMEOUT
    onError(hasCache);
  }
}
