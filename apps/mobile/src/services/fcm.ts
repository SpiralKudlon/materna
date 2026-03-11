import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Alert, Platform } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export async function requestUserPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    console.log('[FCM] Authorization status:', authStatus);
  } else {
    console.warn('[FCM] Push notifications permission denied');
  }
}

export async function registerDeviceToken(jwtToken: string) {
  try {
    // 1. Get the FCM Token
    const fcmToken = await messaging().getToken();
    if (!fcmToken) {
      throw new Error('Could not retrieve FCM token');
    }

    console.log('[FCM] Token acquired:', fcmToken);

    // 2. Register it with the backend (associating device w/ CHV)
    const res = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
      },
      body: JSON.stringify({ fcmToken }),
    });

    if (!res.ok) {
      console.error('[FCM] Failed to sync token to backend', res.status);
    }
  } catch (error) {
    console.error('[FCM] Error registering token:', error);
  }
}

// Handler for when the app is OPEN and a notification arrives
export function applyForegroundListener(onHighRiskAlert?: (data: any) => void) {
  return messaging().onMessage(async (remoteMessage) => {
    console.log('[FCM] Foreground message received:', JSON.stringify(remoteMessage));

    Alert.alert(
      remoteMessage.notification?.title || 'Alert',
      remoteMessage.notification?.body || 'A new update is available.',
      [{ text: 'View Now', onPress: () => onHighRiskAlert?.(remoteMessage.data) }],
      { cancelable: true }
    );
  });
}

// Background headless task (Runs when app is killed or backgrounded)
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('[FCM] Background message received!', JSON.stringify(remoteMessage));
  // The OS will display a system-level Heads Up Notification automatically
  // But we can trigger a pre-fetch or local DB update here if necessary.
});
