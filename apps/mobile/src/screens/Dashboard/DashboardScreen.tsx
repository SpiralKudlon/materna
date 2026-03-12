import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useAssignedPatientsSWR, DashboardPatient } from '../../services/dashboard';
import { AlertCircle, Calendar, ChevronRight, Bell } from 'lucide-react-native';
import SymptomLoggingScreen from '../Symptoms/SymptomLoggingScreen';
import SOSButton from '../../components/SOSButton';

type FilterType = 'ALL' | 'HIGH_RISK' | 'UPCOMING_ANC';

export default function DashboardScreen() {
  const [patients, setPatients] = useState<DashboardPatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [selectedPatient, setSelectedPatient] = useState<DashboardPatient | null>(null);
  const [showSOSModal, setShowSOSModal] = useState(false);

  const fetchPatients = () => {
    setIsRefreshing(true);
    useAssignedPatientsSWR(
      'tenant-1',
      'MOCK_JWT_TOKEN',
      (staleData) => {
        setPatients(staleData);
        setIsLoading(false);
      },
      (freshData) => {
        setPatients(freshData);
        setIsLoading(false);
        setIsRefreshing(false);
      },
      (cacheExisted) => {
        setIsRefreshing(false);
        if (!cacheExisted) {
           setIsLoading(false);
        }
      }
    );
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const filteredPatients = useMemo(() => {
    switch (filter) {
      case 'HIGH_RISK':
        return patients.filter((p) => p.riskTier === 'HIGH');
      case 'UPCOMING_ANC':
        return patients.filter((p) => p.nextAncDate !== undefined);
      default:
        return patients;
    }
  }, [patients, filter]);

  const renderFilterButton = (title: string, type: FilterType) => {
    const isActive = filter === type;
    return (
      <TouchableOpacity
        onPress={() => setFilter(type)}
        className={`px-4 py-2 border rounded-md mr-2 ${
          isActive ? 'border-indigo-600 bg-indigo-50' : 'border-slate-300 bg-white'
        }`}
      >
        <Text className={`text-sm font-semibold ${isActive ? 'text-indigo-700' : 'text-slate-600'}`}>
          {title}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderBadge = (tier: 'LOW' | 'MODERATE' | 'HIGH') => {
    switch (tier) {
      case 'HIGH':
        return (
          <View className="flex-row items-center border border-red-200 bg-red-50 px-2 py-1 rounded-md">
            <AlertCircle color="#dc2626" size={14} />
            <Text className="text-xs font-bold text-red-700 ml-1">HIGH RISK</Text>
          </View>
        );
      case 'MODERATE':
        return (
          <View className="flex-row items-center border border-amber-200 bg-amber-50 px-2 py-1 rounded-md">
            <AlertCircle color="#d97706" size={14} />
            <Text className="text-xs font-bold text-amber-700 ml-1">MODERATE</Text>
          </View>
        );
      case 'LOW':
      default:
        return (
          <View className="flex-row items-center border border-emerald-200 bg-emerald-50 px-2 py-1 rounded-md">
            <Text className="text-xs font-bold text-emerald-700">LOW RISK</Text>
          </View>
        );
    }
  };

  const renderItem = ({ item }: { item: DashboardPatient }) => (
    <TouchableOpacity 
      onPress={() => setSelectedPatient(item)}
      className="bg-white border border-slate-200 p-4 rounded-lg mb-3 flex-row items-center justify-between active:bg-slate-50"
    >
      <View className="flex-1">
        <View className="flex-row justify-between items-start mb-2">
           <Text className="text-base font-bold text-slate-900">{item.fullName}</Text>
           {renderBadge(item.riskTier)}
        </View>
        
        <Text className="text-sm text-slate-500 font-medium mb-3">ID: {item.nationalId}</Text>
        
        {item.nextAncDate && (
          <View className="flex-row items-center pt-2 border-t border-slate-100">
            <Calendar color="#475569" size={14} />
            <Text className="text-xs text-slate-600 ml-1">Next ANC: <Text className="font-semibold text-slate-800">{item.nextAncDate}</Text></Text>
          </View>
        )}
      </View>
      <ChevronRight color="#94a3b8" size={20} className="ml-3" />
    </TouchableOpacity>
  );

  if (selectedPatient) {
    return (
      <SymptomLoggingScreen 
        patientId={selectedPatient.id}
        patientName={selectedPatient.fullName}
        onBack={() => setSelectedPatient(null)}
      />
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="bg-white px-5 pt-8 pb-4 border-b border-slate-200 flex-row justify-between items-center">
        <View>
          <Text className="text-2xl font-bold text-slate-900">Caseload</Text>
          <Text className="text-sm text-slate-500 font-medium">{patients.length} assigned patients</Text>
        </View>
        <TouchableOpacity className="p-2 bg-slate-100 rounded-full">
          <Bell color="#1e293b" size={20} />
        </TouchableOpacity>
      </View>

      <SOSButton 
        jwtToken="MOCK_JWT" 
        tenantId="tenant-1" 
        onActivated={() => {
          Alert.alert('SOS SIGNAL SENT', 'The facility has been notified of an emergency. Please stay calm and follow procedures.');
        }} 
      />

      {/* Filter Bar */}
      <View className="px-5 py-4 bg-white border-b border-slate-200 flex-row">
        {renderFilterButton('All Patients', 'ALL')}
        {renderFilterButton('High Risk', 'HIGH_RISK')}
        {renderFilterButton('Upcoming ANC', 'UPCOMING_ANC')}
      </View>

      <View className="flex-1 px-5 pt-4">
        <View className="flex-row justify-between items-center mb-4">
           <Text className="text-lg font-bold text-slate-900">
             {filter === 'ALL' ? 'My Patients' : filter === 'HIGH_RISK' ? 'Critical Cases' : 'Scheduled Visits'}
           </Text>
           <Text className="text-sm font-semibold text-slate-500">{filteredPatients.length} records</Text>
        </View>

        {isLoading ? (
          <View className="flex-1 justify-center items-center">
             <ActivityIndicator size="large" color="#4f46e5" />
          </View>
        ) : (
          <FlashList
            data={filteredPatients}
            renderItem={renderItem}
            estimatedItemSize={120}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            onRefresh={fetchPatients}
            refreshing={isRefreshing}
            ListEmptyComponent={
              <View className="py-10 items-center justify-center">
                <Text className="text-slate-500 font-semibold mb-2">No patients found</Text>
                <Text className="text-sm text-slate-400 text-center px-6">Ensure your device is connected to sync assignments from the registry.</Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}
