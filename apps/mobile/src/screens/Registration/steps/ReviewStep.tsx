import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRegistrationStore } from '../../../store/registrationStore';
import { ArrowLeft, CheckCircle } from 'lucide-react-native';
import { ApiClient } from '../../../api/client';

export default function ReviewStep({ onPrev, onComplete }: { onPrev: () => void; onComplete: () => void }) {
  const { draft, clearDraft } = useRegistrationStore();

  const handleSubmit = async () => {
    // 1. ApiClient automatically handles detecting offline states 
    // and queueing the request to the syncStore if necessary.
    const result = await ApiClient.request('/api/v1/patients', {
      method: 'POST',
      body: draft,
      jwtToken: 'MOCK_JWT_TOKEN', // In a real flow, extract from AuthStore
      tenantId: 'tenant-1',
      syncType: 'PATIENT_UPDATE', 
    });

    if (result.status === 'queued') {
      Alert.alert('Offline Mode', 'Device is offline. The registration has been queued securely and will sync when internet is restored.');
    } else if (result.error) {
       Alert.alert('Submission Failed', result.error);
       return;
    } else {
      Alert.alert('Success', 'Patient registered successfully.');
    }

    // 2. Clear local draft since it's safely queued or transmitted
    clearDraft();
    onComplete();
  };

  return (
    <View className="flex-1 bg-white p-5 rounded-lg border border-slate-200">
      <Text className="text-xl font-bold text-slate-900 mb-6">Review & Submit</Text>

      <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
        <View className="mb-4">
           <Text className="text-sm font-bold text-slate-800 mb-1 border-b border-slate-100 pb-1">Personal Info</Text>
           <Text className="text-slate-600">Name: {draft.personalInfo?.firstName} {draft.personalInfo?.lastName}</Text>
           <Text className="text-slate-600">DOB: {draft.personalInfo?.dateOfBirth}</Text>
        </View>

        <View className="mb-4">
           <Text className="text-sm font-bold text-slate-800 mb-1 border-b border-slate-100 pb-1">Pregnancy Info</Text>
           <Text className="text-slate-600">EDD: {draft.pregnancyInfo?.estimatedDateOfDelivery}</Text>
           <Text className="text-slate-600">Gravida/Parity: G{draft.pregnancyInfo?.gravida} P{draft.pregnancyInfo?.parity}</Text>
        </View>

        <View className="mb-4">
           <Text className="text-sm font-bold text-slate-800 mb-1 border-b border-slate-100 pb-1">Emergency Contact</Text>
           <Text className="text-slate-600">Name: {draft.emergencyContact?.name} ({draft.emergencyContact?.relationship})</Text>
           <Text className="text-slate-600">Phone: {draft.emergencyContact?.phone}</Text>
        </View>

        <View className="flex-row justify-between pt-4 mt-2 border-t border-slate-200">
          <TouchableOpacity 
            className="flex-row items-center justify-center px-4 py-3 bg-slate-100 rounded-md border border-slate-200 active:bg-slate-200 w-1/3"
            onPress={onPrev}
          >
            <ArrowLeft color="#475569" size={18} />
            <Text className="ml-1 text-slate-700 font-semibold">Back</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="flex-row items-center justify-center px-4 py-3 bg-emerald-600 rounded-md active:bg-emerald-700 w-1/2"
            onPress={handleSubmit}
          >
            <CheckCircle color="#ffffff" size={18} />
            <Text className="ml-1 text-white font-semibold flex-1 text-center">Complete</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
