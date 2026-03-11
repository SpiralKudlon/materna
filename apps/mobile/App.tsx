import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Button, FlatList, SafeAreaView } from 'react-native';
import { useNetworkSync } from './hooks/useNetworkSync';
import { useSyncStore } from './store/syncStore';
import { requestUserPermission, applyForegroundListener } from './services/fcm';
import * as Network from 'expo-network';

export default function App() {
  const [isConnected, setConnected] = useState<boolean>(true);
  
  // Initialize the sync hook with a pseudo-JWT (simulating logged in CHV)
  const { processQueue, pendingCount } = useNetworkSync('MOCK_JWT_TOKEN');
  const { queue, enqueue } = useSyncStore();

  useEffect(() => {
    // 1. Setup Push Notifications
    requestUserPermission();
    
    // 2. Setup Foreground listener
    const unsubscribe = applyForegroundListener((data) => {
      console.log('User tapped the push notification action:', data);
    });

    // 3. Monitor generic network state (simple UI indicator)
    Network.getNetworkStateAsync().then((state) => {
      setConnected(!!state.isConnected && !!state.isInternetReachable);
    });

    return () => unsubscribe();
  }, []);

  const handleSimulateLogSymptom = () => {
    // Simulate what the UI would do when saving
    enqueue({
      type: 'SYMPTOM_LOG',
      endpoint: '/symptoms',
      method: 'POST',
      payload: { patientId: 'patient-123', symptoms: ['FEVER', 'HEADACHE'] },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Maternal-AI CHV App</Text>
        <View style={[styles.statusBadge, { backgroundColor: isConnected ? '#4caf50' : '#f44336' }]}>
          <Text style={styles.statusText}>{isConnected ? 'ONLINE' : 'OFFLINE'}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Offline Sync Queue</Text>
        <Text style={styles.subtitle}>Pending items: {pendingCount}</Text>
        
        <View style={styles.actions}>
          <Button title="1. Log Symptom (Push to Queue)" onPress={handleSimulateLogSymptom} />
          <View style={{ height: 10 }} />
          <Button title="2. Force Trigger Sync Drain" color="#ff9800" onPress={processQueue} />
        </View>
      </View>

      <FlatList
        data={queue}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.queueItem}>
            <Text style={styles.queueText}>{item.type} → {item.endpoint}</Text>
            <Text style={styles.queueTime}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 20, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  card: { margin: 20, padding: 20, backgroundColor: '#fff', borderRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 5 },
  subtitle: { color: '#666', marginBottom: 20 },
  actions: { marginTop: 10 },
  queueItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#ddd', flexDirection: 'row', justifyContent: 'space-between' },
  queueText: { fontSize: 14, color: '#333' },
  queueTime: { fontSize: 12, color: '#999' }
});
