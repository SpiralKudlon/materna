import React from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { useRegistrationStore } from '../../store/registrationStore';
import PersonalInfoStep from './steps/PersonalInfoStep';
import PregnancyInfoStep from './steps/PregnancyInfoStep';
import MedicalHistoryStep from './steps/MedicalHistoryStep';
import EmergencyContactStep from './steps/EmergencyContactStep';
import ReviewStep from './steps/ReviewStep';

export default function RegistrationScreen({ onComplete }: { onComplete: () => void }) {
  const { currentStep, setStep } = useRegistrationStore();

  const handleNext = () => setStep(Math.min(currentStep + 1, 4));
  const handlePrev = () => setStep(Math.max(currentStep - 1, 0));

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <PersonalInfoStep onNext={handleNext} onPrev={handlePrev} />;
      case 1: return <PregnancyInfoStep onNext={handleNext} onPrev={handlePrev} />;
      case 2: return <MedicalHistoryStep onNext={handleNext} onPrev={handlePrev} />;
      case 3: return <EmergencyContactStep onNext={handleNext} onPrev={handlePrev} />;
      case 4: return <ReviewStep onNext={() => {}} onPrev={handlePrev} onComplete={onComplete} />;
      default: return <PersonalInfoStep onNext={handleNext} onPrev={handlePrev} />;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="px-5 py-3 bg-white border-b border-slate-200 flex-row justify-between items-center">
        <Text className="text-lg font-bold text-slate-800">New Patient</Text>
        <View className="bg-slate-100 px-3 py-1 rounded-full">
          <Text className="text-slate-600 font-semibold text-xs">Step {currentStep + 1} of 5</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View className="h-1 w-full bg-slate-200">
        <View 
          className="h-1 bg-indigo-600" 
          style={{ width: `${((currentStep + 1) / 5) * 100}%` }} 
        />
      </View>

      <View className="flex-1 p-5">
        {renderStep()}
      </View>
    </SafeAreaView>
  );
}
