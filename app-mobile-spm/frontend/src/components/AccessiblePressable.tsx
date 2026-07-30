import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, GestureResponderEvent } from 'react-native';
import * as Speech from 'expo-speech';
import { useAuth } from '@/src/auth';

type Props = React.ComponentProps<typeof Pressable> & {
  label?: string;
};

export default function AccessiblePressable({ children, onPress, label, ...rest }: Props) {
  const { user } = useAuth();
  const enabled = user?.accessibility_enabled ?? false;
  const [awaiting, setAwaiting] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current as any);
    };
  }, []);

  const speakLabel = useCallback((text: string) => {
    try {
      Speech.stop();
      Speech.speak(text, { rate: 0.95 });
    } catch (e) {
      // ignore
    }
  }, []);

  const handlePress = useCallback((e?: GestureResponderEvent) => {
    if (!enabled) {
      if (onPress) onPress(e as any);
      return;
    }

    // when accessibility mode on: first press reads label, second press triggers
    if (!awaiting) {
      const text = label || extractTextFromChildren(children) || 'Botão';
      speakLabel(text);
      setAwaiting(true);
      timeoutRef.current = setTimeout(() => setAwaiting(false), 4000) as any;
      return;
    }

    // second press
    if (timeoutRef.current) { clearTimeout(timeoutRef.current as any); timeoutRef.current = null; }
    setAwaiting(false);
    if (onPress) onPress(e as any);
  }, [enabled, awaiting, label, children, onPress, speakLabel]);

  return (
    <Pressable {...rest} onPress={handlePress}>
      {children}
    </Pressable>
  );
}

function extractTextFromChildren(children: any): string | null {
  if (!children) return null;
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) {
    for (const c of children) {
      const t = extractTextFromChildren(c);
      if (t) return t;
    }
    return null;
  }
  if (children.props && children.props.children) return extractTextFromChildren(children.props.children);
  return null;
}
