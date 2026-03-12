import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { 
  AlertCircle, 
  Droplet, 
  Eye, 
  Thermometer, 
  Zap, 
  CloudRain, 
  Info,
  Waves,
  ZapOff,
  Activity
} from 'lucide-react-native';

export type SymptomType = 
  | 'HEADACHE' 
  | 'BLEEDING' 
  | 'BLURRED_VISION' 
  | 'SWELLING' 
  | 'ABDOMINAL_PAIN' 
  | 'FEVER' 
  | 'DIZZINESS' 
  | 'REDUCED_FETAL_MOVEMENT' 
  | 'CONVULSIONS' 
  | 'WEAKNESS';

export const SYMPTOMS: { type: SymptomType; label: string; Icon: any }[] = [
  { type: 'HEADACHE', label: 'Headache', Icon: Zap },
  { type: 'BLEEDING', label: 'Bleeding', Icon: Droplet },
  { type: 'BLURRED_VISION', label: 'Blurred Vision', Icon: Eye },
  { type: 'SWELLING', label: 'Swelling', Icon: Waves },
  { type: 'ABDOMINAL_PAIN', label: 'Abdominal Pain', Icon: Activity },
  { type: 'FEVER', label: 'Fever', Icon: Thermometer },
  { type: 'DIZZINESS', label: 'Dizziness', Icon: Waves },
  { type: 'REDUCED_FETAL_MOVEMENT', label: 'Less Movement', Icon: Activity },
  { type: 'CONVULSIONS', label: 'Convulsions', Icon: ZapOff },
  { type: 'WEAKNESS', label: 'Weakness', Icon: CloudRain },
];

interface SymptomGridProps {
  selectedSymptoms: Set<SymptomType>;
  onToggleSymptom: (type: SymptomType) => void;
}

export default function SymptomGrid({ selectedSymptoms, onToggleSymptom }: SymptomGridProps) {
  return (
    <View className="flex-row flex-wrap justify-between">
      {SYMPTOMS.map(({ type, label, Icon }) => {
        const isSelected = selectedSymptoms.has(type);
        return (
          <TouchableOpacity
            key={type}
            onPress={() => onToggleSymptom(type)}
            className={`w-[48%] mb-4 p-4 border rounded-xl items-center justify-center ${
              isSelected ? 'bg-indigo-50 border-indigo-600' : 'bg-white border-slate-200'
            }`}
          >
            <View className={`p-2 rounded-full mb-2 ${isSelected ? 'bg-indigo-100' : 'bg-slate-50'}`}>
              <Icon size={24} color={isSelected ? '#4f46e5' : '#64748b'} />
            </View>
            <Text className={`text-sm font-semibold text-center ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
