import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import { colors, spacing, radius, font } from '@/src/theme';
import { api } from '@/src/api';

export default function ExamDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    (async () => { try { setExam(await api.getExam(id!)); } catch {} finally { setLoading(false); } })();
  }, [id]));

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.brandPrimary} />;
  if (!exam) return <Text style={{ padding: 24 }}>Não encontrado</Text>;

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <View style={styles.header}>
        <AccessiblePressable onPress={() => router.back()} style={styles.back} testID="exam-back" label="Voltar">
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </AccessiblePressable>
        <Text style={styles.title}>{exam.kind === 'prescription' ? 'Receita' : 'Exame'}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <View style={styles.icon}>
            <Ionicons name={exam.kind === 'prescription' ? 'receipt' : 'document-text'} size={40} color={colors.brandPrimary} />
          </View>
          <Text style={styles.name}>{exam.title}</Text>
          <Text style={styles.meta}>{exam.doctor_name || 'Documento'} • {dayjs(exam.date).format('DD/MM/YYYY')}</Text>
          <View style={[styles.badge, { backgroundColor: exam.status === 'ready' ? colors.brandGreenSoft : colors.warningSoft }]}>
            <Text style={[styles.badgeTxt, { color: exam.status === 'ready' ? colors.brandSecondary : colors.warning }]}>
              {exam.status === 'ready' ? 'Pronto' : 'Aguardando'}
            </Text>
          </View>
        </View>

        {exam.summary && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>Resumo</Text>
            <Text style={styles.secTxt}>{exam.summary}</Text>
          </View>
        )}

        <AccessiblePressable style={styles.cta} testID="download-btn">
          <Ionicons name="download" size={20} color="#fff" />
          <Text style={styles.ctaTxt}>Baixar PDF</Text>
        </AccessiblePressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.onSurface },
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', backgroundColor: '#fff', padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  icon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  name: { fontSize: font.xl, fontWeight: '700', color: colors.onSurface, textAlign: 'center' },
  meta: { fontSize: font.sm, color: colors.muted, marginTop: 4 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill, marginTop: spacing.sm },
  badgeTxt: { fontSize: font.sm, fontWeight: '700' },
  section: { backgroundColor: '#fff', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  secTitle: { fontSize: font.sm, fontWeight: '700', color: colors.muted, marginBottom: spacing.sm, textTransform: 'uppercase' },
  secTxt: { fontSize: font.base, color: colors.onSurface, lineHeight: 22 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.md, minHeight: 56 },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: font.lg },
});
