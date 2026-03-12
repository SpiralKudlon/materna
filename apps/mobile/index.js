import { registerRootComponent } from 'expo';
import App from './App';
import { NotificationService } from './src/services/notifications';

// Register background handler early
NotificationService.setupBackgroundHandler();

registerRootComponent(App);
