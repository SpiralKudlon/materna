import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EmergencyContactSchema, EmergencyContact } from 'shared-types';
import { useRegistrationStore } from '../../../store/registrationStore';
import { ArrowRight, ArrowLeft } from 'lucide-react-native';

interface Props {
  onNext: () => void;
  onPrev: () => void;
}

export default function EmergencyContactStep({ onNext, onPrev }: Props) {
  const { draft, updateDraft } = useRegistrationStore();
  
  const { control, handleSubmit, formState: { errors } } = useForm<EmergencyContact>({
    resolver: zodResolver(EmergencyContactSchema),
    defaultValues: draft.emergencyContact || {},
  });

  const onSubmit = (data: EmergencyContact) => {
    updateDraft({ emergencyContact: data });
    onNext();
  };

  return (
    <View className="flex-1 bg-white p-5 rounded-lg border border-slate-200">
      <Text className="text-xl font-bold text-slate-900 mb-6">Emergency Contact</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="mb-4">
          <Text className="text-sm font-semibold text-slate-700 mb-1">Contact Name</Text>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className={`border rounded-md px-3 py-2.5 text-slate-900 ${errors.name ? 'border-red-500' : 'border-slate-300'}`}
                onChangeText={onChange}
                value={value}
                placeholder="John Doe"
              />
            )}
          />
          {errors.name && <Text className="text-xs text-red-500 mt-1">{errors.name.message}</Text>}
        </View>

        <View className="mb-4">
          <Text className="text-sm font-semibold text-slate-700 mb-1">Relationship to Patient</Text>
          <Controller
            control={control}
            name="relationship"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className={`border rounded-md px-3 py-2.5 text-slate-900 ${errors.relationship ? 'border-red-500' : 'border-slate-300'}`}
                onChangeText={onChange}
                value={value}
                placeholder="e.g. Husband, Sister"
              />
            )}
          />
          {errors.relationship && <Text className="text-xs text-red-500 mt-1">{errors.relationship.message}</Text>}
        </View>

        <View className="mb-6">
          <Text className="text-sm font-semibold text-slate-700 mb-1">Phone Number</Text>
          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className={`border rounded-md px-3 py-2.5 text-slate-900 ${errors.phone ? 'border-red-500' : 'border-slate-300'}`}
                onChangeText={onChange}
                value={value}
                keyboardType="phone-pad"
                placeholder="0700000000"
              />
            )}
          />
          {errors.phone && <Text className="text-xs text-red-500 mt-1">{errors.phone.message}</Text>}
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
