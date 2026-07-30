import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, FlatList } from 'react-native';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
dayjs.locale('pt-br');
import { colors, spacing, radius, font } from '@/src/theme';
import { api } from '@/src/api';
import { scheduleAppointmentReminders } from '@/src/notifications';

type Apt = {
  id: string; doctor_name: string; specialty: string; location: string;
  scheduled_at: string; status: string; queue_position?: number;
};

export default function Appointments() {
  const router = useRouter();
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');
  const [items, setItems] = useState<Apt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const d = await api.listAppointments(); setItems(d); try { await scheduleAppointmentReminders(d || []); } catch {} }
    catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const now = dayjs();
  const CANCELLED_STATUSES = new Set(['cancelled', 'cancelado']);
  const COMPLETED_STATUSES = new Set(['completed', 'compareceu', 'realizada']);
  const filtered = items.filter(a => {
    const status = String(a.status || '').toLowerCase();
    if (tab === 'upcoming') return dayjs(a.scheduled_at).isAfter(now) && !CANCELLED_STATUSES.has(status) && !COMPLETED_STATUSES.has(status);
    return dayjs(a.scheduled_at).isBefore(now) || CANCELLED_STATUSES.has(status) || COMPLETED_STATUSES.has(status);
  });

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Consultas</Text>
        <AccessiblePressable style={styles.addBtn} onPress={() => router.push('/appointment/book')} testID="appointments-add-btn" label="Adicionar consulta">
          <Ionicons name="add" size={24} color="#fff" />
        </AccessiblePressable>
      </View>

      <View style={styles.segRow}>
        <AccessiblePressable onPress={() => setTab('upcoming')} testID="tab-upcoming"
          style={[styles.seg, tab === 'upcoming' && styles.segOn]} label="Próximas consultas">
          <Text style={[styles.segTxt, tab === 'upcoming' && styles.segTxtOn]}>Próximas</Text>
        </AccessiblePressable>
        <AccessiblePressable onPress={() => setTab('history')} testID="tab-history"
          style={[styles.seg, tab === 'history' && styles.segOn]} label="Histórico de consultas">
          <Text style={[styles.segTxt, tab === 'history' && styles.segTxtOn]}>Histórico</Text>
        </AccessiblePressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.brandPrimary} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={64} color={colors.borderStrong} />
          <Text style={styles.emptyTxt}>Nenhuma consulta {tab === 'upcoming' ? 'agendada' : 'no histórico'}</Text>
          {tab === 'upcoming' && (
            <AccessiblePressable style={styles.emptyBtn} onPress={() => router.push('/appointment/book')} testID="empty-book-btn" label="Agendar consulta">
              <Text style={styles.emptyBtnTxt}>Agendar consulta</Text>
            </AccessiblePressable>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item }) => <AptCard apt={item} onPress={() => router.push(`/appointment/${item.id}`)} />}
        />
      )}
    </SafeAreaView>
  );
}

function AptCard({ apt, onPress }: { apt: Apt; onPress: () => void }) {
  const statusColor = {
    confirmed: colors.brandSecondary,
    waitlist: colors.warning,
    cancelled: colors.error,
    completed: colors.muted,
  }[apt.status] || colors.brandPrimary;
  const statusLabel = {
    confirmed: 'Confirmada', waitlist: 'Fila de espera',
    cancelled: 'Cancelada', completed: 'Realizada',
  }[apt.status] || apt.status;

  return (
    <AccessiblePressable style={styles.card} onPress={onPress} testID={`appointment-card-${apt.id}`} label={`Consulta com ${apt.doctor_name}, ${apt.specialty}, em ${dayjs(apt.scheduled_at).format('DD/MM/YYYY HH:mm')}`}>
      <View style={styles.cardTop}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>
        {apt.queue_position != null && <Text style={styles.queue}>  •  Posição {apt.queue_position}</Text>}
      </View>
      <Text style={styles.doc}>{apt.doctor_name}</Text>
      <Text style={styles.spec}>{apt.specialty}</Text>
      <View style={styles.metaRow}>
        <Ionicons name="calendar" size={14} color={colors.muted} />
        <Text style={styles.meta}>{dayjs(apt.scheduled_at).format('DD/MM/YYYY [•] HH:mm')}</Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="location" size={14} color={colors.muted} />
        <Text style={styles.meta}>{apt.location}</Text>
      </View>
    </AccessiblePressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: font.xxl, fontWeight: '700', color: colors.onSurface },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  segRow: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surfaceTertiary, padding: 4, borderRadius: radius.md },
  seg: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm },
  segOn: { backgroundColor: '#fff' },
  segTxt: { color: colors.muted, fontWeight: '600' },
  segTxtOn: { color: colors.brandPrimary },
  card: { backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  status: { fontSize: font.sm, fontWeight: '700' },
  queue: { fontSize: font.sm, color: colors.muted },
  doc: { fontSize: font.lg, fontWeight: '700', color: colors.onSurface },
  spec: { fontSize: font.sm, color: colors.brandPrimary, marginTop: 2, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: 6 },
  meta: { fontSize: font.sm, color: colors.muted },
  empty: { alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: spacing.lg },
  emptyTxt: { color: colors.muted, fontSize: font.base, marginTop: spacing.md, textAlign: 'center' },
  emptyBtn: { marginTop: spacing.lg, backgroundColor: colors.brandPrimary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: radius.md },
  emptyBtnTxt: { color: '#fff', fontWeight: '700' },
});
