import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, RefreshControl, Alert } from 'react-native';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '@/src/theme';
import { api } from '@/src/api';
import { scheduleMedicationReminders } from '@/src/notifications';

type Medication = {
  id: string;
  name: string;
  dosage?: string;
  frequency?: string;
  stock: number;
  notes?: string;
  reminder_time?: string;
  color?: string;
};

export default function Medications() {
  const router = useRouter();
  const [items, setItems] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.listMedications();
      setItems(data || []);
      try { await scheduleMedicationReminders(data || []); } catch {}
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const lowStock = useMemo(() => items.filter((item) => item.stock <= 5).length, [items]);

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Remédios</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Resumo</Text>
          <Text style={styles.summaryText}>{items.length} medicamentos cadastrados</Text>
          {lowStock > 0 && <Text style={styles.warning}>⚠️ {lowStock} com estoque baixo</Text>}
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.brandPrimary} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="medical-outline" size={64} color={colors.borderStrong} />
            <Text style={styles.emptyTxt}>Nenhum remédio cadastrado</Text>
          </View>
        ) : (
          items.map((item) => (
            <AccessiblePressable key={item.id} style={styles.card} onPress={() => router.push({ pathname: '/medications/[id]', params: { id: item.id } })} testID={`med-card-${item.id}`}>
              <View style={[styles.icon, { backgroundColor: item.color ? `${item.color}20` : colors.brandTertiary }]}
              >
                <Ionicons name="medical" size={22} color={item.color || colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardMeta}>{item.dosage || 'Dose não informada'} • {item.frequency || 'freq. não informada'}</Text>
                {item.reminder_time ? <Text style={styles.cardReminder}>Horário: {formatReminder(item.reminder_time)}</Text> : null}
                <Text style={styles.cardStock}>Estoque: {item.stock}</Text>
              </View>
              {item.stock <= 5 && <View style={styles.lowChip}><Text style={styles.lowChipTxt}>Baixo</Text></View>}
            </AccessiblePressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatReminder(raw: any) {
  if (!raw) return '';
  try {
    let arr = raw;
    if (typeof raw === 'string') {
      // try JSON
      if (raw.trim().startsWith('[')) arr = JSON.parse(raw);
      else if (raw.includes(',')) arr = raw.split(',').map((s: string) => s.trim());
      else arr = [raw];
    }
    if (Array.isArray(arr)) {
      const times = arr.map((t: string) => `às ${t}`);
      if (times.length === 1) return times[0];
      if (times.length === 2) return times.join(' e ');
      return times.slice(0, -1).join(', ') + ' e ' + times.slice(-1);
    }
    return String(raw);
  } catch (e) {
    return String(raw);
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: font.xxl, fontWeight: '700', color: colors.onSurface },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  summary: { backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  summaryTitle: { fontSize: font.base, fontWeight: '700', color: colors.onSurface },
  summaryText: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  warning: { color: colors.error, fontWeight: '700', marginTop: 6 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#fff', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: font.base, fontWeight: '700', color: colors.onSurface },
  cardMeta: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  cardReminder: { fontSize: font.sm, color: colors.brandSecondary, marginTop: 4, fontWeight: '600' },
  cardStock: { fontSize: font.sm, color: colors.brandPrimary, marginTop: 4, fontWeight: '600' },
  lowChip: { backgroundColor: colors.warningSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  lowChipTxt: { color: colors.warning, fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyTxt: { color: colors.muted, fontSize: font.base, marginTop: spacing.md },
  emptyBtn: { marginTop: spacing.lg, backgroundColor: colors.brandPrimary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: radius.md },
  emptyBtnTxt: { color: '#fff', fontWeight: '700' },
});
