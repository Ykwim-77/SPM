import React, { useCallback } from 'react';
import { TextInput, TextInputProps } from 'react-native';
import * as Speech from 'expo-speech';
import { useAuth } from '@/src/auth';

type Props = TextInputProps & { label?: string };

export default function AccessibleTextInput({ label, onFocus, ...rest }: Props) {
  const { user } = useAuth();
  const enabled = user?.accessibility_enabled ?? false;

  const handleFocus = useCallback((e: any) => {
    if (enabled) {
      try { Speech.stop(); Speech.speak(label || rest.placeholder || 'Campo'); } catch (e) {}
    }
    if (onFocus) onFocus(e);
  }, [enabled, label, rest.placeholder, onFocus]);

  return (
    <TextInput
      {...rest}
      onFocus={handleFocus}
    />
  );
}
