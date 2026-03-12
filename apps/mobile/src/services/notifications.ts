import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import { Alert, Platform } from 'react-native';
import { ApiClient } from '../api/client';

export class NotificationService {
  static initialize() {
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch (e) {
      console.error('[NotificationService] Failed to set handler:', e);
    }
  }
  static async requestUserPermission() {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      
      if (enabled) {
        console.log('[NotificationService] Permission granted:', authStatus);
      } else {
        console.warn('[NotificationService] Permission denied');
      }
      return enabled;
    } catch (error) {
      console.error('[NotificationService] Error requesting permission:', error);
      return false;
    }
  }

  static async registerForPushNotifications(jwtToken: string, tenantId: string) {
    try {
      const hasPermission = await this.requestUserPermission();
      if (!hasPermission) return;

      // Get FCM Token
      const token = await messaging().getToken();
      console.log('FCM Token:', token);

      // Register token with backend
      await ApiClient.request('/api/v1/users/me/device-token', {
        method: 'PATCH',
        body: { token, platform: Platform.OS },
        jwtToken,
        tenantId,
      });

    } catch (error) {
      console.error('Failed to register for notifications:', error);
    }
  }

  static setupListeners() {
    // Foreground listener
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      console.log('Foreground Notification:', remoteMessage);
      
      const { title, body } = remoteMessage.notification || {};
      const type = remoteMessage.data?.type;

      if (type === 'HIGH_RISK_ALERT') {
        Alert.alert(
          '🚨 HIGH RISK ALERT',
          body || 'A patient in your caseload has been flagged as HIGH RISK.',
          [{ text: 'View Dashboard', style: 'default' }]
        );
      } else {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: title || 'Maternal-AI Update',
            body: body || '',
            data: remoteMessage.data,
          },
          trigger: null,
        });
      }
    });

    // Background/Quit state notification tap
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification opened app from background:', remoteMessage);
    });

    messaging().getInitialNotification().then(remoteMessage => {
      if (remoteMessage) {
        console.log('Notification opened app from quit state:', remoteMessage);
      }
    });

    return unsubscribe;
  }
}
