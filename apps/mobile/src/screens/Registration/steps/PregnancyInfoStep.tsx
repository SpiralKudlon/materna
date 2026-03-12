import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PregnancyInfoSchema, PregnancyInfo } from 'shared-types';
import { useRegistrationStore } from '../../../store/registrationStore';
import { ArrowRight, ArrowLeft } from 'lucide-react-native';

interface Props {
  onNext: () => void;
  onPrev: () => void;
}

export default function PregnancyInfoStep({ onNext, onPrev }: Props) {
  const { draft, updateDraft } = useRegistrationStore();
  
  const { control, handleSubmit, formState: { errors } } = useForm<PregnancyInfo>({
    resolver: zodResolver(PregnancyInfoSchema),
    defaultValues: draft.pregnancyInfo || { gravida: 1, parity: 0 },
  });

  const onSubmit = (data: PregnancyInfo) => {
    updateDraft({ pregnancyInfo: data });
    onNext();
  };

  return (
    <View className="flex-1 bg-white p-5 rounded-lg border border-slate-200">
      <Text className="text-xl font-bold text-slate-900 mb-6">Pregnancy Information</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="mb-4">
          <Text className="text-sm font-semibold text-slate-700 mb-1">Last Menstrual Period (LMP)</Text>
          <Controller
            control={control}
            name="lastMenstrualPeriod"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className={`border rounded-md px-3 py-2.5 text-slate-900 ${errors.lastMenstrualPeriod ? 'border-red-500' : 'border-slate-300'}`}
                onChangeText={onChange}
                value={value}
                placeholder="YYYY-MM-DD"
              />
            )}
          />
          {errors.lastMenstrualPeriod && <Text className="text-xs text-red-500 mt-1">{errors.lastMenstrualPeriod.message}</Text>}
        </View>

        <View className="mb-4">
          <Text className="text-sm font-semibold text-slate-700 mb-1">Estimated Date of Delivery (EDD)</Text>
          <Controller
            control={control}
            name="estimatedDateOfDelivery"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className={`border rounded-md px-3 py-2.5 text-slate-900 ${errors.estimatedDateOfDelivery ? 'border-red-500' : 'border-slate-300'}`}
                onChangeText={onChange}
                value={value}
                placeholder="YYYY-MM-DD"
              />
            )}
          />
          {errors.estimatedDateOfDelivery && <Text className="text-xs text-red-500 mt-1">{errors.estimatedDateOfDelivery.message}</Text>}
        </View>

        <View className="mb-4">
          <Text className="text-sm font-semibold text-slate-700 mb-1">Gravida (Number of Pregnancies)</Text>
          <Controller
            control={control}
            name="gravida"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className={`border rounded-md px-3 py-2.5 text-slate-900 ${errors.gravida ? 'border-red-500' : 'border-slate-300'}`}
                onChangeText={(text) => onChange(text)}
                value={value?.toString() || ''}
                keyboardType="numeric"
              />
            )}
          />
          {errors.gravida && <Text className="text-xs text-red-500 mt-1">{errors.gravida.message}</Text>}
        </View>

        <View className="mb-6">
          <Text className="text-sm font-semibold text-slate-700 mb-1">Parity (Number of Live Births)</Text>
          <Controller
            control={control}
            name="parity"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className={`border rounded-md px-3 py-2.5 text-slate-900 ${errors.parity ? 'border-red-500' : 'border-slate-300'}`}
                onChangeText={(text) => onChange(text)}
                value={value?.toString() || ''}
                keyboardType="numeric"
              />
            )}
          />
          {errors.parity && <Text className="text-xs text-red-500 mt-1">{errors.parity.message}</Text>}
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
