import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

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
  
  // 1. Check Network Connectivity
  const network = await Network.getNetworkStateAsync();

  if (network.isConnected && network.isInternetReachable) {
    try {
      // 2a. Fetch from API
      const response = await fetch(`${API_BASE_URL}/api/v1/patients/${patientId}`, {
        headers: {
          'x-tenant-id': tenantId,
          'Authorization': `Bearer ${jwtToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const profile: PatientProfile = await response.json();

      // 3. Save to Offline Cache asynchronously
      AsyncStorage.setItem(cacheKey, JSON.stringify(profile)).catch(console.error);

      return { profile, isOfflineCached: false };
    } catch (err) {
      console.warn('[ProfileService] API fetch failed, falling back to cache:', err);
      // Fall through to cache logic
    }
  }

  // 2b. Offline Fallback
  const cachedData = await AsyncStorage.getItem(cacheKey);
  if (cachedData) {
    return {
      profile: JSON.parse(cachedData) as PatientProfile,
      isOfflineCached: true,
    };
  }

  throw new Error('Device is offline and no cached profile exists.');
}
