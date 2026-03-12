import { registerRootComponent } from 'expo';
import "@react-native-firebase/app";
import messaging from '@react-native-firebase/messaging';
import App from './App';

// Register background handler early - this MUST be outside component lifecycles
// Adding safety guard for early boot phase
try {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('[FCM] Background handler invoked:', remoteMessage.data);
  });
} catch (e) {
  console.error('[FCM] Failed to set background handler:', e);
}

registerRootComponent(App);
