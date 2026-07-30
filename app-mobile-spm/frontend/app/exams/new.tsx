import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '@/src/theme';

export default function NewExam() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <View style={styles.header}>
        <AccessiblePressable onPress={() => router.back()} style={styles.back} testID="exam-new-back" label="Voltar">
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </AccessiblePressable>
        <Text style={styles.title}>Registrar exame</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.message}>O cadastro de exames não está disponível no app móvel.</Text>
        <Text style={styles.subtext}>Use a aplicação web para registrar exames e documentos.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.onSurface },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
  message: { fontSize: font.base, color: colors.onSurface, fontWeight: '700', textAlign: 'center', marginBottom: spacing.sm },
  subtext: { fontSize: font.sm, color: colors.muted, textAlign: 'center' },
});
