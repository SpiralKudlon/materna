import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SymptomSeverity } from '../../../../shared-types';

interface SeveritySelectorProps {
  symptomLabel: string;
  value: SymptomSeverity | null;
  onSelect: (severity: SymptomSeverity) => void;
}

export default function SeveritySelector({ symptomLabel, value, onSelect }: SeveritySelectorProps) {
  const severities: { label: string; value: SymptomSeverity; color: string; bgColor: string; borderColor: string }[] = [
    { 
      label: 'Mild', 
      value: 'MILD', 
      color: 'text-emerald-700', 
      bgColor: 'bg-emerald-50', 
      borderColor: 'border-emerald-200' 
    },
    { 
      label: 'Moderate', 
      value: 'MODERATE', 
      color: 'text-amber-700', 
      bgColor: 'bg-amber-50', 
      borderColor: 'border-amber-200' 
    },
    { 
      label: 'Severe', 
      value: 'SEVERE', 
      color: 'text-rose-700', 
      bgColor: 'bg-rose-50', 
      borderColor: 'border-rose-200' 
    },
  ];

  return (
    <View className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-6">
      <Text className="text-sm font-bold text-slate-900 mb-3">How intense is the {symptomLabel}?</Text>
      <View className="flex-row justify-between">
        {severities.map((s) => {
          const isSelected = value === s.value;
          return (
            <TouchableOpacity
              key={s.value}
              onPress={() => onSelect(s.value)}
              className={`flex-1 mx-1 py-3 border rounded-lg items-center ${
                isSelected ? `${s.bgColor} ${s.borderColor} border-2` : 'bg-white border-slate-200'
              }`}
            >
              <Text className={`text-sm font-bold ${isSelected ? s.color : 'text-slate-600'}`}>
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
