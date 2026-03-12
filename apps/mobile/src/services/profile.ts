import { ApiClient } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PatientProfile {
  id: string;
  nationalId: string;
  fullName: string;
  dateOfBirth: string;
  phone: string;
  status: 'ACTIVE' | 'TRANSFERRED' | 'COMPLETED';
  facilityId: string;
  isHighRisk: boolean;
}

const CACHE_KEY_PREFIX = '@patient_profile_';

export async function fetchPatientProfile(
  tenantId: string,
  patientId: string,
  jwtToken: string
): Promise<{ profile: PatientProfile; isOfflineCached: boolean }> {
  const cacheKey = `${CACHE_KEY_PREFIX}${patientId}`;
  
  // 1. ApiClient performs GET (does not queue, falls through on error)
  const { data: profile, status } = await ApiClient.request<PatientProfile>(`/api/v1/patients/${patientId}`, {
    method: 'GET',
    jwtToken,
    tenantId,
  });

  if (status === 'sent' && profile) {
    // 2. Save to Offline Cache asynchronously
    AsyncStorage.setItem(cacheKey, JSON.stringify(profile)).catch(console.error);
    return { profile, isOfflineCached: false };
  }

  // 3. Offline Fallback
  const cachedData = await AsyncStorage.getItem(cacheKey);
  if (cachedData) {
    return {
      profile: JSON.parse(cachedData) as PatientProfile,
      isOfflineCached: true,
    };
  }

  throw new Error('Device is offline and no cached profile exists.');
}
