import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import SymptomGrid, { SymptomType, SYMPTOMS } from './components/SymptomGrid';
import SeveritySelector from './components/SeveritySelector';
import RiskResultModal from './components/RiskResultModal';
import { logSymptom } from '../../services/symptoms';
import { SymptomSeverity } from '../../../../shared-types';

interface SymptomLoggingScreenProps {
  patientId: string;
  patientName: string;
  onBack: () => void;
}

export default function SymptomLoggingScreen({ patientId, patientName, onBack }: SymptomLoggingScreenProps) {
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<SymptomType>>(new Set());
  const [severities, setSeverities] = useState<Partial<Record<SymptomType, SymptomSeverity>>>({});
  const [activeSymptom, setActiveSymptom] = useState<SymptomType | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; tier: 'LOW' | 'MODERATE' | 'HIGH' } | null>(null);

  const toggleSymptom = (type: SymptomType) => {
    setSelectedSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
        // Also remove its severity
        setSeverities((s) => {
          const n = { ...s };
          delete n[type];
          return n;
        });
        if (activeSymptom === type) setActiveSymptom(null);
      } else {
        next.add(type);
        setActiveSymptom(type);
      }
      return next;
    });
  };

  const handleSelectSeverity = (severity: SymptomSeverity) => {
    if (activeSymptom) {
      setSeverities((prev) => ({ ...prev, [activeSymptom]: severity }));
    }
  };

  const canSubmit = selectedSymptoms.size > 0 && 
    Array.from(selectedSymptoms).every((s) => severities[s] !== undefined);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    
    setIsSubmitting(true);
    try {
      const payload = {
        patientId,
        symptoms: Array.from(selectedSymptoms).map((s) => ({
          type: s,
          severity: severities[s] as SymptomSeverity,
        })),
        reportedAt: new Date(),
      };

      const resp = await logSymptom('tenant-1', payload, 'MOCK_JWT');
      
      // Mocked risk calculation based on severities for demo
      // In reality, this would come from the API response
      const hasSevere = Object.values(severities).includes('SEVERE');
      const hasModerateCount = Object.values(severities).filter(s => s === 'MODERATE').length;
      
      let mockScore = 5 + (selectedSymptoms.size * 10);
      if (hasSevere) mockScore += 40;
      if (hasModerateCount > 1) mockScore += 20;
      mockScore = Math.min(mockScore, 98);

      let mockTier: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
      if (mockScore > 75) mockTier = 'HIGH';
      else if (mockScore > 35) mockTier = 'MODERATE';

      setResult({ score: mockScore, tier: mockTier });

    } catch (err) {
      Alert.alert('Error', 'Failed to log symptoms. The log has been queued for sync.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSymptomLabel = SYMPTOMS.find(s => s.type === activeSymptom)?.label || '';

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="px-5 py-4 border-b border-slate-200 flex-row items-center">
        <TouchableOpacity onPress={onBack} className="mr-3 p-1">
          <ArrowLeft color="#0f172a" size={24} />
        </TouchableOpacity>
        <View>
           <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">Health Assessment</Text>
           <Text className="text-lg font-bold text-slate-900">{patientName}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        <Text className="text-base font-bold text-slate-900 mb-2">Identify Symptoms</Text>
        <Text className="text-sm text-slate-500 mb-6 font-medium">
          Select all that apply for this patient visit.
        </Text>

        <SymptomGrid 
          selectedSymptoms={selectedSymptoms} 
          onToggleSymptom={toggleSymptom} 
        />

        {activeSymptom && (
          <SeveritySelector 
            symptomLabel={activeSymptomLabel}
            value={severities[activeSymptom] || null}
            onSelect={handleSelectSeverity}
          />
        )}

        {selectedSymptoms.size > 0 && !activeSymptom && (
          <View className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl mb-6">
            <Text className="text-sm text-indigo-700 font-medium">
              {selectedSymptoms.size} symptoms selected. Tap a selected symptom to change its intensity.
            </Text>
          </View>
        )}

        <View className="h-10" />
      </ScrollView>

      {/* Bottom Action */}
      <View className="p-5 border-t border-slate-200 bg-slate-50">
        <TouchableOpacity 
          onPress={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className={`py-4 rounded-xl flex-row items-center justify-center ${
            canSubmit ? 'bg-indigo-600' : 'bg-slate-300'
          }`}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <>
              <Text className="text-white font-bold text-lg mr-2">Submit Assessment</Text>
              <ChevronRight color="#ffffff" size={20} />
            </>
          )}
        </TouchableOpacity>
      </View>

      {result && (
        <RiskResultModal 
          visible={!!result}
          onClose={() => {
            setResult(null);
            onBack();
          }}
          riskScore={result.score}
          riskTier={result.tier}
        />
      )}
    </View>
  );
}
