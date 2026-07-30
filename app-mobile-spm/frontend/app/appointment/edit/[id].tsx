import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
dayjs.locale('pt-br');
import { colors, spacing, radius, font } from '@/src/theme';
import { api } from '@/src/api';

type Specialty = { key: string; icon: string; description: string; treats: string[]; doctors: string[] };

export default function EditAppointment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<any>(null);
  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [doctor, setDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);

  const days = Array.from({ length: 14 }, (_, i) => dayjs().add(i, 'day'));

  const loadData = useCallback(async () => {
    try {
      const [specs, apt] = await Promise.all([api.specialties(), api.getAppointment(id!) ]);
      setSpecialties(specs);
      setAppointment(apt);
      setSpecialty(specs.find((item: Specialty) => item.key === apt.specialty) || specs[0] || null);
      setDoctor(apt.doctor_name || specs[0]?.doctors?.[0] || '');
      setSelectedDate(dayjs(apt.scheduled_at).format('YYYY-MM-DD'));
      setTime(dayjs(apt.scheduled_at).format('HH:mm'));
      setNotes(apt.notes || '');
    } catch (e) {
      setError('Não foi possível carregar a consulta.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!specialty || !doctor || !selectedDate || !appointment) return;
    (async () => {
      setSlotsLoading(true);
      try {
        const r = await api.availableSlots(specialty.key, doctor, selectedDate, id!);
        setAvailableTimes(r.available || []);
      } catch {
        setAvailableTimes([]);
      } finally {
        setSlotsLoading(false);
      }
    })();
  }, [specialty, doctor, selectedDate, appointment, id]);

  const submit = async () => {
    if (!specialty || !doctor || !time) {
      setError('Escolha especialidade, médico e horário.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const scheduledAt = dayjs(`${selectedDate}T${time}`).second(0).toISOString();
      await api.updateAppointment(id!, {
        doctor_name: doctor,
        specialty: specialty.key,
        location: appointment.location || 'UBS Centro - Sala 3',
        scheduled_at: scheduledAt,
        notes: notes || undefined,
      });
      router.replace(`/appointment/${id}`);
    } catch (e: any) {
      setError(e?.message || 'Falha ao reagendar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.brandPrimary} />;
  if (!appointment) return <Text style={{ padding: 24 }}>Consulta não encontrada</Text>;

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <View style={styles.header}>
        <AccessiblePressable onPress={() => router.back()} style={styles.back} testID="edit-back" label="Voltar">
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </AccessiblePressable>
        <Text style={styles.headerTitle}>Reagendar consulta</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <Text style={styles.sectionTitle}>Especialidade</Text>
          <View style={styles.selectionGrid}>
            {specialties.map((item) => {
              const active = specialty?.key === item.key;
              return (
                <AccessiblePressable
                  key={item.key}
                  onPress={() => {
                    setSpecialty(item);
                    setDoctor(item.doctors[0] || '');
                  }}
                  label={item.label || item.key}
                  style={[styles.selectionChip, active && styles.selectionChipOn]}
                  testID={`spec-${item.key}`}
                >
                  <Text style={[styles.selectionText, active && styles.selectionTextOn]}>{item.key}</Text>
                </AccessiblePressable>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Médico</Text>
          <View style={styles.selectionGrid}>
            {(specialty?.doctors || []).map((doc) => {
              const active = doctor === doc;
              return (
                <AccessiblePressable
                  key={doc}
                  onPress={() => setDoctor(doc)}
                  label={`Médico: ${doc}`}
                  style={[styles.selectionChip, active && styles.selectionChipOn]}
                  testID={`doc-${doc}`}
                >
                  <Text style={[styles.selectionText, active && styles.selectionTextOn]}>{doc}</Text>
                </AccessiblePressable>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Data</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
            {days.map((day) => {
              const iso = day.format('YYYY-MM-DD');
              const selected = iso === selectedDate;
              return (
                <AccessiblePressable
                  key={iso}
                  onPress={() => setSelectedDate(iso)}
                  label={day.format('dddd, DD [de] MMMM')}
                  style={[styles.dayChip, selected && styles.dayChipOn]}
                  testID={`edit-day-${iso}`}
                >
                  <Text style={[styles.dayWk, selected && styles.dayWkOn]}>{day.format('dd').toUpperCase()}</Text>
                  <Text style={[styles.dayNum, selected && styles.dayNumOn]}>{day.format('DD')}</Text>
                </AccessiblePressable>
              );
            })}
          </ScrollView>

          <Text style={styles.sectionTitle}>Horário</Text>
          {slotsLoading ? (
            <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: 12 }} />
          ) : availableTimes.length === 0 ? (
            <Text style={styles.noTimes}>Nenhum horário disponível para esse dia.</Text>
          ) : (
            <View style={styles.timeGrid}>
              {availableTimes.map((slot) => {
                const active = time === slot;
                return (
                  <AccessiblePressable
                    key={slot}
                    onPress={() => setTime(slot)}
                    label={`Horário ${slot}`}
                    style={[styles.timeBtn, active && styles.timeBtnOn]}
                    testID={`edit-time-${slot}`}
                  >
                    <Text style={[styles.timeTxt, active && styles.timeTxtOn]}>{slot}</Text>
                  </AccessiblePressable>
                );
              })}
            </View>
          )}

          <Text style={styles.sectionTitle}>Observações</Text>
          <TextInput
            style={styles.textArea}
            value={notes}
            onChangeText={setNotes}
            placeholder="Descreva o que mudou ou o motivo do reagendamento"
            placeholderTextColor={colors.muted}
            multiline
            testID="edit-notes"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <AccessiblePressable
            style={[styles.actionBtn, (!time || saving) && styles.actionBtnDisabled]}
            onPress={submit}
            disabled={!time || saving}
            testID="save-edit"
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Salvar mudanças</Text>}
          </AccessiblePressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: font.lg, fontWeight: '700', color: colors.onSurface },
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: { fontSize: font.sm, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.sm, marginTop: spacing.md },
  selectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  selectionChip: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', marginBottom: spacing.sm },
  selectionChipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  selectionText: { color: colors.onSurface, fontSize: font.sm },
  selectionTextOn: { color: '#fff' },
  dateRow: { gap: 8, paddingBottom: spacing.sm },
  dayChip: { width: 72, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', alignItems: 'center' },
  dayChipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  dayWk: { fontSize: 10, color: colors.muted, fontWeight: '700' },
  dayWkOn: { color: '#fff' },
  dayNum: { fontSize: font.lg, fontWeight: '700', marginTop: 4, color: colors.onSurface },
  dayNumOn: { color: '#fff' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  timeBtnOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  timeTxt: { fontSize: font.sm, color: colors.onSurface },
  timeTxtOn: { color: '#fff' },
  noTimes: { color: colors.muted, fontSize: font.sm, marginVertical: spacing.sm },
  textArea: { backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, minHeight: 120, textAlignVertical: 'top', color: colors.onSurface, fontSize: font.base },
  actionBtn: { marginTop: spacing.xl, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandSecondary, alignItems: 'center', justifyContent: 'center', minHeight: 56 },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: font.lg },
  error: { color: colors.error, marginTop: spacing.sm },
});
