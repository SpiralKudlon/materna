import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PatientRegistration } from 'shared-types';

export interface RegistrationDraft extends Partial<PatientRegistration> {
  // Can be fully empty when starting
}

interface RegistrationState {
  currentStep: number;
  draft: RegistrationDraft;
  setStep: (step: number) => void;
  updateDraft: (data: Partial<RegistrationDraft>) => void;
  clearDraft: () => void;
}

export const useRegistrationStore = create<RegistrationState>()(
  persist(
    (set, get) => ({
      currentStep: 0, // Starts at 0 (Personal Info)
      draft: {},
      
      setStep: (step) => set({ currentStep: step }),
      
      updateDraft: (data) => set((state) => ({ 
        draft: { 
          ...state.draft, 
          ...data 
        } 
      })),
      
      clearDraft: () => set({ currentStep: 0, draft: {} }),
    }),
    {
      name: 'patient-registration-draft',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
