import React from 'react';
import { View, Text, Modal, TouchableOpacity, Linking } from 'react-native';
import { AlertTriangle, Phone, CheckCircle2, X } from 'lucide-react-native';

interface RiskResultModalProps {
  visible: boolean;
  onClose: () => void;
  riskScore: number;
  riskTier: 'LOW' | 'MODERATE' | 'HIGH';
  onEmergencyTrigger?: () => void;
}

export default function RiskResultModal({ 
  visible, 
  onClose, 
  riskScore, 
  riskTier,
  onEmergencyTrigger 
}: RiskResultModalProps) {
  
  const handleCallSOS = () => {
    Linking.openURL('tel:911'); // Mock emergency number
    if (onEmergencyTrigger) onEmergencyTrigger();
  };

  const isHighRisk = riskTier === 'HIGH';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/50 justify-center items-center px-6">
        <View className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl border border-slate-200">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-xl font-bold text-slate-900">Assessment Result</Text>
            <TouchableOpacity onPress={onClose}>
              <X color="#64748b" size={24} />
            </TouchableOpacity>
          </View>

          <View className={`items-center py-8 rounded-xl mb-6 ${
            isHighRisk ? 'bg-rose-50 border border-rose-100' : 
            riskTier === 'MODERATE' ? 'bg-amber-50 border border-amber-100' : 
            'bg-emerald-50 border border-emerald-100'
          }`}>
            <View className={`p-3 rounded-full mb-3 ${
              isHighRisk ? 'bg-rose-100' : 
              riskTier === 'MODERATE' ? 'bg-amber-100' : 
              'bg-emerald-100'
            }`}>
              {isHighRisk ? (
                <AlertTriangle color="#e11d48" size={32} />
              ) : (
                <CheckCircle2 color="#059669" size={32} />
              )}
            </View>
            <Text className={`text-4xl font-bold ${
              isHighRisk ? 'text-rose-700' : 
              riskTier === 'MODERATE' ? 'text-amber-700' : 
              'text-emerald-700'
            }`}>
              {riskScore}%
            </Text>
            <Text className={`text-lg font-bold mt-1 ${
              isHighRisk ? 'text-rose-900' : 
              riskTier === 'MODERATE' ? 'text-amber-900' : 
              'text-emerald-900'
            }`}>
              {riskTier} RISK
            </Text>
          </View>

          <View className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
            <Text className="text-sm text-slate-600 leading-relaxed">
              {isHighRisk 
                ? "This patient requires immediate medical attention. Follow survival procedures and transport to the referral hospital."
                : riskTier === 'MODERATE' 
                  ? "Monitor closely. Increase visit frequency and review danger signs with the patient."
                  : "Continue routine care and scheduled ANC visits."}
            </Text>
          </View>

          {isHighRisk ? (
            <TouchableOpacity 
              onPress={handleCallSOS}
              className="bg-rose-600 flex-row items-center justify-center py-4 rounded-xl active:bg-rose-700"
            >
              <Phone color="#ffffff" size={20} />
              <Text className="text-white font-bold text-lg ml-2">EMERGENCY SOS</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={onClose}
              className="bg-slate-900 py-4 rounded-xl items-center active:bg-slate-800"
            >
              <Text className="text-white font-bold text-lg">DONE</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}
