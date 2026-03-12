import React, { useEffect, useState } from 'react';
import { Text, View, FlatList, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNetworkSync } from './src/hooks/useNetworkSync';
import { useSyncStore } from './src/store/syncStore';
import { NotificationService } from './src/services/notifications';
import { logSymptom } from './src/services/symptoms';
import NetInfo from '@react-native-community/netinfo';
import { Wifi, WifiOff, CloudUpload, Activity, UserPlus, Home } from 'lucide-react-native';
import RegistrationScreen from './src/screens/Registration/RegistrationScreen';
import DashboardScreen from './src/screens/Dashboard/DashboardScreen';

// Note: In real app, configure NativeWind globals. For demo, NativeWind processes className strings.

export default function App() {
  console.log('[DEBUG] App.tsx: Component rendering');
  const [isConnected, setConnected] = useState<boolean>(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'registration'>('dashboard');
  
  const { processQueue, pendingCount } = useNetworkSync('MOCK_JWT_TOKEN');
  const { queue } = useSyncStore();

  useEffect(() => {
    // New Expo/Firebase Notification Service (Consolidated)
    // NotificationService.initialize();
    // NotificationService.requestUserPermission();
    // const unsubscribeNotifications = NotificationService.setupListeners();
    // NotificationService.registerForPushNotifications('MOCK_JWT_TOKEN', 'tenant-1');

    const unsubscribeNet = NetInfo.addEventListener((state) => {
      setConnected(!!state.isConnected && !!state.isInternetReachable);
    });

    return () => {
      // unsubscribeNotifications();
      unsubscribeNet();
    };
  }, []);

  const handleSimulateLogSymptom = async () => {
    const result = await logSymptom('tenant-1', {
      patientId: 'patient-123',
      symptoms: ['FEVER', 'HEADACHE']
    }, 'MOCK_JWT');
    console.log('[App] Log symptom result:', result.status);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="px-5 py-4 bg-white flex-row justify-between items-center shadow-sm border-b border-slate-200">
        <View className="flex-row items-center space-x-2">
          <Activity color="#0f172a" size={24} />
          <Text className="text-xl font-bold text-slate-900 ml-2">Maternal-AI</Text>
        </View>
        <View className="flex-row items-center gap-x-3">
           <TouchableOpacity onPress={() => setCurrentView(currentView === 'dashboard' ? 'registration' : 'dashboard')}>
              {currentView === 'dashboard' ? <UserPlus color="#475569" size={20} /> : <Home color="#475569" size={20} />}
           </TouchableOpacity>
           <View className={`px-3 py-1.5 rounded-full flex-row items-center ${isConnected ? 'bg-emerald-100' : 'bg-rose-100'}`}>
             {isConnected ? <Wifi color="#059669" size={16} /> : <WifiOff color="#e11d48" size={16} />}
             <Text className={`ml-1 text-xs font-bold ${isConnected ? 'text-emerald-700' : 'text-rose-700'}`}>
               {isConnected ? 'ONLINE' : 'OFFLINE'}
             </Text>
           </View>
        </View>
      </View>

      {currentView === 'registration' ? (
         <RegistrationScreen onComplete={() => setCurrentView('dashboard')} />
      ) : (
         <DashboardScreen />
      )}
    </SafeAreaView>
  );
}
