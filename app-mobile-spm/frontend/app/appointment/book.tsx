import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
dayjs.locale('pt-br');
import { colors, spacing, radius, font } from '@/src/theme';
import { api } from '@/src/api';

type Specialty = {
  key: string; icon: string; description: string; treats: string[]; doctors: string[];
};

export default function BookAppointment() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [specialty] = useState<Specialty | null>({ key: 'UPA', icon: 'person', description: 'Atendimento UPA', treats: [], doctors: ['UPA'] });
  const [doctor] = useState('UPA');
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [takenTimes, setTakenTimes] = useState<string[]>([]);
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    // always load available slots for UPA
    (async () => {
      setSlotsLoading(true);
      setTime('');
      try {
        const r: any = await api.availableSlots(specialty?.key || 'UPA', doctor, selectedDate);
        const taken: string[] = (r.taken || []) as string[];
        const avail: string[] = (r.available || []).filter((t: string) => !taken.includes(t));
        // ensure unique and sorted
        const uniq = Array.from(new Set(avail)).sort() as string[];
        setAvailableTimes(uniq);
        setTakenTimes(taken);
      } catch {}
      finally { setSlotsLoading(false); }
    })();
  }, [selectedDate]);

  const submit = async () => {
    if (!time) return;
    setSubmitting(true);
    try {
      const [h, m] = time.split(':').map(Number);
      const scheduledAt = dayjs(selectedDate).hour(h).minute(m).second(0).toISOString();
      await api.createAppointment({
        doctor_name: 'UPA',
        specialty: 'UPA',
        location: 'UPA',
        scheduled_at: scheduledAt,
        notes: notes || undefined,
      });
      Alert.alert('Sucesso', 'Consulta agendada!', [{ text: 'OK', onPress: () => router.replace('/(tabs)/appointments') }]);
    } catch (e: any) {
      Alert.alert('Não foi possível agendar', e?.message || 'Falha ao agendar');
    } finally { setSubmitting(false); }
  };

  // Build next 14 consecutive days including today
  const days = Array.from({ length: 14 }, (_, i) => dayjs().add(i, 'day'));

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <View style={styles.header}>
        <AccessiblePressable onPress={() => router.back()} style={styles.back} testID="book-back" label="Voltar">
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </AccessiblePressable>
        <Text style={styles.headerTitle}>Agendar consulta</Text>
        <Text style={styles.step}></Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            <>
              <View style={styles.stepHint}>
                <Ionicons name="person" size={18} color={colors.brandPrimary} />
                <Text style={styles.stepHintTxt}>UPA</Text>
              </View>
              
              <Text style={styles.title}>Data e horário</Text>
              <Text style={styles.subLbl}>Dia</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
                {days.map(d => {
                  const iso = d.format('YYYY-MM-DD');
                  const on = iso === selectedDate;
                  const isWeekend = d.day() === 0 || d.day() === 6;
                  return (
                    <AccessiblePressable
                      key={iso}
                      onPress={() => setSelectedDate(iso)}
                      label={`${d.format('dddd')}, ${d.format('DD')} de ${d.format('MMMM')}`}
                      style={[styles.dayChip, on && styles.dayOn, isWeekend && !on && styles.dayDim]}
                      testID={`day-${iso}`}
                    >
                      <Text style={[styles.dayWk, on && { color: '#fff' }]}>{d.format('ddd').toUpperCase().slice(0, 3)}</Text>
                      <Text style={[styles.dayTop, on && { color: '#fff' }]}>{d.format('DD')}</Text>
                      <Text style={[styles.dayBot, on && { color: '#fff' }]}>{d.format('MMM')}</Text>
                    </AccessiblePressable>
                  );
                })}
              </ScrollView>

              <Text style={styles.subLbl}>Horários disponíveis</Text>
              <Text style={styles.helpTxt}>Apenas horários livres são mostrados.</Text>
              {slotsLoading ? (
                <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: 12 }} />
              ) : availableTimes.length === 0 ? (
                <Text style={styles.noTimes}>Nenhum horário disponível para esse dia e médico.</Text>
              ) : (
                <View style={styles.timesWrap}>
                  {availableTimes.map((t) => {
                    const on = time === t;
                    return (
                      <AccessiblePressable
                        key={t}
                        onPress={() => setTime(t)}
                        label={`Horário ${t}`}
                        style={[styles.timeChip, on && styles.timeOn]}
                        testID={`time-${t}`}
                      >
                        <Text style={[styles.timeTxt, on && { color: '#fff' }]}>{t}</Text>
                      </AccessiblePressable>
                    );
                  })}
                </View>
              )}

              <Text style={styles.subLbl}>Observações (opcional)</Text>
              <TextInput
                style={styles.input} value={notes} onChangeText={setNotes}
                placeholder="Algo que o médico precise saber?"
                placeholderTextColor={colors.muted} multiline testID="book-notes"
              />

              <AccessiblePressable
                style={[styles.cta, !time && styles.ctaDisabled]}
                onPress={submit}
                disabled={submitting || !time}
                testID="book-confirm"
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>{time ? `Confirmar às ${time}` : 'Escolha um horário'}</Text>}
              </AccessiblePressable>
            </>
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
  step: { fontSize: font.sm, color: colors.muted, width: 44, textAlign: 'right' },
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.onSurface, marginBottom: 4 },
  subtitle: { fontSize: font.sm, color: colors.muted, marginBottom: spacing.md },
  stepHint: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.brandTertiary, padding: 10, borderRadius: radius.sm, marginBottom: spacing.md },
  stepHintTxt: { color: colors.brandPrimary, fontWeight: '700' },
  specCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#fff', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  specIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  specTitle: { fontSize: font.base, fontWeight: '700', color: colors.onSurface },
  specDesc: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  treatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  treatChip: { backgroundColor: colors.brandGreenSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  treatTxt: { fontSize: 11, color: colors.brandSecondary, fontWeight: '600' },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#fff', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, minHeight: 64 },
  docAv: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  docName: { fontSize: font.base, fontWeight: '700', color: colors.onSurface },
  docSpec: { fontSize: font.sm, color: colors.muted },
  subLbl: { fontSize: font.sm, fontWeight: '600', color: colors.onSurfaceTertiary, marginTop: spacing.md, marginBottom: spacing.sm },
  dayChip: { width: 64, paddingVertical: 8, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', flexShrink: 0 },
  dayOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  dayDim: { opacity: 0.5 },
  dayWk: { fontSize: 10, color: colors.muted, fontWeight: '700', letterSpacing: 0.5 },
  dayTop: { fontSize: font.lg, fontWeight: '700', color: colors.onSurface, marginTop: 2 },
  dayBot: { fontSize: 11, color: colors.muted, textTransform: 'uppercase' },
  timesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, minWidth: 82, alignItems: 'center' },
  timeOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  timeOff: { backgroundColor: colors.surfaceTertiary, borderColor: colors.border },
  timeTxt: { fontSize: font.base, color: colors.onSurface, fontWeight: '600' },
  helpTxt: { fontSize: font.sm, color: colors.muted, marginBottom: spacing.sm },
  timeMark: { fontSize: 10, color: colors.muted, marginTop: 2 },
  noTimes: { color: colors.muted, fontSize: font.sm, marginTop: spacing.sm },
  input: { backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: font.base, color: colors.onSurface, minHeight: 88, textAlignVertical: 'top' },
  cta: { marginTop: spacing.xl, backgroundColor: colors.brandSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', minHeight: 56, justifyContent: 'center' },
  ctaDisabled: { opacity: 0.4 },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: font.lg },
});
