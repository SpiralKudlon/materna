import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ShieldAlert } from 'lucide-react-native';
import { ApiClient } from '../api/client';

interface SOSButtonProps {
  onActivated: () => void;
  jwtToken: string;
  tenantId: string;
}

export default function SOSButton({ onActivated, jwtToken, tenantId }: SOSButtonProps) {
  const [isHolding, setIsHolding] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef<NodeJS.Timeout | null>(null);
  const hapticInterval = useRef<NodeJS.Timeout | null>(null);

  const startHold = () => {
    setIsHolding(true);
    
    // Start progress animation (3 seconds)
    Animated.timing(progress, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    }).start();

    // Trigger periodic haptic feedback
    hapticInterval.current = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 500);

    // Set activation timer
    holdTimer.current = setTimeout(async () => {
      cancelHold();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      try {
        await ApiClient.request('/api/v1/sos', {
           method: 'POST',
           body: { timestamp: new Date(), type: 'EMERGENCY_SOS' },
           jwtToken,
           tenantId,
           syncType: 'SOS_SIGNAL'
        });
        onActivated();
      } catch (err) {
        console.error('SOS request failed, but queued in Sync Store');
        onActivated();
      }
    }, 3000);
  };

  const cancelHold = () => {
    setIsHolding(false);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (hapticInterval.current) clearInterval(hapticInterval.current);
    
    progress.stopAnimation();
    Animated.spring(progress, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View className="items-center justify-center p-4">
      <Pressable
        onPressIn={startHold}
        onPressOut={cancelHold}
        className={`w-full h-20 rounded-2xl overflow-hidden border-2 ${
          isHolding ? 'border-rose-600' : 'border-slate-200'
        } bg-white shadow-sm`}
      >
        {/* Progress Bar Background */}
        <Animated.View 
          className="absolute h-full bg-rose-100" 
          style={{ width: progressWidth }}
        />

        <View className="flex-1 flex-row items-center justify-center px-6">
          <ShieldAlert color={isHolding ? '#e11d48' : '#64748b'} size={28} />
          <View className="ml-4">
            <Text className={`font-bold text-lg ${isHolding ? 'text-rose-700' : 'text-slate-900'}`}>
              {isHolding ? 'HOLDING FOR SOS...' : 'HOLD FOR EMERGENCY SOS'}
            </Text>
            <Text className="text-xs text-slate-500 font-medium">
              Sends alert to facility & tracks location
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}
