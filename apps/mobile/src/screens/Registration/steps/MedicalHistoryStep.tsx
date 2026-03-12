import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MedicalHistorySchema, MedicalHistory } from 'shared-types';
import { useRegistrationStore } from '../../../store/registrationStore';
import { ArrowRight, ArrowLeft } from 'lucide-react-native';

interface Props {
  onNext: () => void;
  onPrev: () => void;
}

export default function MedicalHistoryStep({ onNext, onPrev }: Props) {
  const { draft, updateDraft } = useRegistrationStore();
  
  const { control, handleSubmit, formState: { errors } } = useForm<MedicalHistory>({
    resolver: zodResolver(MedicalHistorySchema),
    defaultValues: draft.medicalHistory || { existingConditions: [], allergies: [], previousComplications: [] },
  });

  const onSubmit = (data: MedicalHistory) => {
    updateDraft({ medicalHistory: data });
    onNext();
  };

  // Utility to map comma separated strings back to an array for the schema
  const parseArray = (text: string) => text.split(',').map(s => s.trim()).filter(Boolean);

  return (
    <View className="flex-1 bg-white p-5 rounded-lg border border-slate-200">
      <Text className="text-xl font-bold text-slate-900 mb-6">Medical History</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="mb-4">
          <Text className="text-sm font-semibold text-slate-700 mb-1">Existing Conditions (comma separated)</Text>
          <Controller
            control={control}
            name="existingConditions"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className={`border rounded-md px-3 py-2.5 text-slate-900 ${errors.existingConditions ? 'border-red-500' : 'border-slate-300'}`}
                onChangeText={(text) => onChange(parseArray(text))}
                value={value?.join(', ')}
                placeholder="e.g. Hypertension, Diabetes"
              />
            )}
          />
        </View>

        <View className="mb-4">
          <Text className="text-sm font-semibold text-slate-700 mb-1">Known Allergies (comma separated)</Text>
          <Controller
            control={control}
            name="allergies"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className={`border rounded-md px-3 py-2.5 text-slate-900 ${errors.allergies ? 'border-red-500' : 'border-slate-300'}`}
                onChangeText={(text) => onChange(parseArray(text))}
                value={value?.join(', ')}
                placeholder="e.g. Penicillin, Peanuts"
              />
            )}
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-semibold text-slate-700 mb-1">Previous Pregnancy Complications</Text>
          <Controller
            control={control}
            name="previousComplications"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className={`border rounded-md px-3 py-2.5 text-slate-900 ${errors.previousComplications ? 'border-red-500' : 'border-slate-300'}`}
                onChangeText={(text) => onChange(parseArray(text))}
                value={value?.join(', ')}
                placeholder="e.g. Pre-eclampsia, PPH"
              />
            )}
          />
        </View>

        <View className="flex-row justify-between pt-4 border-t border-slate-200">
          <TouchableOpacity 
            className="flex-row items-center justify-center px-4 py-3 bg-slate-100 rounded-md border border-slate-200 active:bg-slate-200 w-1/3"
            onPress={onPrev}
          >
            <ArrowLeft color="#475569" size={18} />
            <Text className="ml-1 text-slate-700 font-semibold">Back</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="flex-row items-center justify-center px-4 py-3 bg-indigo-600 rounded-md active:bg-indigo-700 w-1/2"
            onPress={handleSubmit(onSubmit)}
          >
            <Text className="mr-1 text-white font-semibold">Next Step</Text>
            <ArrowRight color="#ffffff" size={18} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
