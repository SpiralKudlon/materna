import React, { useEffect, useState } from 'react';
import { Text, View, FlatList, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNetworkSync } from './src/hooks/useNetworkSync';
import { useSyncStore } from './src/store/syncStore';
import { requestUserPermission, applyForegroundListener } from './src/services/fcm';
import { logSymptom } from './src/services/symptoms';
import NetInfo from '@react-native-community/netinfo';
import { Wifi, WifiOff, CloudUpload, Activity } from 'lucide-react-native';
// Note: In real app, configure NativeWind globals. For demo, NativeWind processes className strings.

export default function App() {
  const [isConnected, setConnected] = useState<boolean>(true);
  
  const { processQueue, pendingCount } = useNetworkSync('MOCK_JWT_TOKEN');
  const { queue } = useSyncStore();

  useEffect(() => {
    requestUserPermission();
    
    const unsubscribeFcm = applyForegroundListener((data) => {
      console.log('User tapped the push notification action:', data);
    });

    const unsubscribeNet = NetInfo.addEventListener((state) => {
      setConnected(!!state.isConnected && !!state.isInternetReachable);
    });

    return () => {
      unsubscribeFcm();
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
      <View className="p-5 bg-white flex-row justify-between items-center shadow-sm border-b border-slate-200">
        <View className="flex-row items-center space-x-2">
          <Activity color="#0f172a" size={24} />
          <Text className="text-xl font-bold text-slate-900 ml-2">Maternal-AI</Text>
        </View>
        <View className={`px-3 py-1.5 rounded-full flex-row items-center ${isConnected ? 'bg-emerald-100' : 'bg-rose-100'}`}>
          {isConnected ? <Wifi color="#059669" size={16} /> : <WifiOff color="#e11d48" size={16} />}
          <Text className={`ml-1 text-xs font-bold ${isConnected ? 'text-emerald-700' : 'text-rose-700'}`}>
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>
      </View>

      <View className="m-5 p-5 bg-white rounded-xl shadow-sm border border-slate-200">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-lg font-semibold text-slate-900">Sync Queue</Text>
          <View className="bg-slate-100 px-2 py-1 rounded-md">
            <Text className="text-slate-600 font-medium">{pendingCount} Pending</Text>
          </View>
        </View>
        
        <View className="mt-4 gap-y-3">
          <TouchableOpacity 
            className="bg-indigo-600 py-3 rounded-lg items-center flex-row justify-center active:bg-indigo-700"
            onPress={handleSimulateLogSymptom}
          >
            <Activity color="#ffffff" size={18} />
            <Text className="text-white font-semibold ml-2">Log Symptom</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="bg-amber-500 py-3 rounded-lg items-center flex-row justify-center active:bg-amber-600"
            onPress={processQueue}
          >
            <CloudUpload color="#ffffff" size={18} />
            <Text className="text-white font-semibold ml-2">Force Sync</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        className="px-5"
        data={queue}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="p-4 mb-3 bg-white rounded-lg border border-slate-200 flex-row justify-between items-center shadow-sm">
            <View>
              <Text className="text-sm font-bold text-slate-800">{item.type}</Text>
              <Text className="text-xs text-slate-500 mt-1">{item.method} {item.endpoint}</Text>
            </View>
            <Text className="text-xs text-slate-400 font-medium">
              {new Date(item.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
