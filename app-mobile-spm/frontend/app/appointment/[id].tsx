import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, TextInput, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
dayjs.locale('pt-br');
import { colors, spacing, radius, font } from '@/src/theme';
import { api } from '@/src/api';

const CANCEL_REASONS = [
  'Não vou conseguir comparecer',
  'Já não preciso mais',
  'Consegui atendimento em outro lugar',
  'Encontrei horário melhor',
  'Outro motivo',
];

export default function AppointmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [apt, setApt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setApt(await api.getAppointment(id!)); }
    catch {} finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const doCancel = async () => {
    const final = reason === 'Outro motivo' ? customReason.trim() : reason;
    if (!final || final.length < 3) {
      setError('Informe o motivo do cancelamento.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.cancelAppointment(id!, final);
      setShowCancel(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Falha ao cancelar');
    } finally { setBusy(false); }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.brandPrimary} />;
  if (!apt) return <Text style={{ padding: 24 }}>Consulta não encontrada</Text>;

  const canCancel = apt.status === 'confirmed' || apt.status === 'waitlist';

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <View style={styles.header}>
        <AccessiblePressable onPress={() => router.back()} style={styles.back} testID="apt-back" label="Voltar">
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </AccessiblePressable>
        <Text style={styles.headerTitle}>Detalhes</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <View style={styles.docIcon}>
            <Ionicons name="person" size={40} color={colors.brandPrimary} />
          </View>
          <Text style={styles.doc}>{apt.doctor_name}</Text>
          <Text style={styles.spec}>{apt.specialty}</Text>
        </View>

        <InfoRow icon="calendar" label="Data e horário"
          value={dayjs(apt.scheduled_at).format('DD [de] MMMM [de] YYYY [às] HH:mm')} />
        <InfoRow icon="location" label="Local" value={apt.location} />
        <InfoRow icon="checkmark-circle" label="Status" value={statusLabel(apt.status)}
          testID="apt-status" />
        {apt.queue_position != null && (
          <InfoRow icon="hourglass" label="Posição na fila" value={String(apt.queue_position)} />
        )}
        {apt.notes && <InfoRow icon="document" label="Observações" value={apt.notes} />}
        {apt.cancellation_reason && (
          <InfoRow icon="close-circle" label="Motivo do cancelamento" value={apt.cancellation_reason} />
        )}

        {canCancel && (
          <AccessiblePressable style={styles.editBtn} onPress={() => router.push(`/appointment/edit/${apt.id}`)} label="Reagendar consulta" testID="open-edit-btn">
            <Ionicons name="pencil" size={20} color={colors.brandPrimary} />
            <Text style={styles.editTxt}>Reagendar consulta</Text>
          </AccessiblePressable>
        )}
        {canCancel && (
          <AccessiblePressable style={styles.cancelBtn} onPress={() => { setShowCancel(true); setReason(''); setCustomReason(''); setError(null); }} label="Cancelar consulta" testID="open-cancel-btn">
            <Ionicons name="close-circle" size={20} color={colors.error} />
            <Text style={styles.cancelTxt}>Cancelar consulta</Text>
          </AccessiblePressable>
        )}
      </ScrollView>

      <Modal visible={showCancel} transparent animationType="slide" onRequestClose={() => setShowCancel(false)}>
        <View style={styles.sheetWrap}>
          <AccessiblePressable style={styles.sheetBg} onPress={() => setShowCancel(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Motivo do cancelamento</Text>
              <Text style={styles.sheetSub}>Nos ajude a melhorar informando por quê.</Text>

              <ScrollView style={{ maxHeight: 260 }}>
                {CANCEL_REASONS.map(r => (
                  <AccessiblePressable
                    key={r}
                    onPress={() => setReason(r)}
                    style={[styles.reasonRow, reason === r && styles.reasonOn]}
                    testID={`reason-${r}`}
                  >
                    <View style={[styles.radio, reason === r && styles.radioOn]}>
                      {reason === r && <View style={styles.radioDot} />}
                    </View>
                    <Text style={styles.reasonTxt}>{r}</Text>
                  </AccessiblePressable>
                ))}
              </ScrollView>

              {reason === 'Outro motivo' && (
                <TextInput
                  value={customReason}
                  onChangeText={setCustomReason}
                  placeholder="Descreva o motivo"
                  placeholderTextColor={colors.muted}
                  style={styles.customInput}
                  testID="reason-custom-input"
                  multiline
                />
              )}

              {error && <Text style={styles.errorTxt}>{error}</Text>}

              <View style={styles.sheetActions}>
                <AccessiblePressable onPress={() => setShowCancel(false)} style={styles.sheetBack} label="Voltar" testID="cancel-cancel-btn">
                  <Text style={styles.sheetBackTxt}>Voltar</Text>
                </AccessiblePressable>
                <AccessiblePressable
                  onPress={doCancel}
                  disabled={busy}
                  style={[styles.sheetConfirm, busy && { opacity: 0.6 }]}
                  label="Confirmar cancelar consulta"
                  testID="confirm-cancel-btn"
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.sheetConfirmTxt}>Cancelar consulta</Text>}
                </AccessiblePressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function statusLabel(s: string) {
  return { confirmed: 'Confirmada', waitlist: 'Fila de espera', cancelled: 'Cancelada', completed: 'Realizada' }[s] || s;
}

function InfoRow({ icon, label, value, testID }: any) {
  return (
    <View style={styles.info} testID={testID}>
      <Ionicons name={icon} size={20} color={colors.brandPrimary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLbl}>{label}</Text>
        <Text style={styles.infoVal}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: font.lg, fontWeight: '700', color: colors.onSurface },
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', backgroundColor: colors.brandTertiary, padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.lg },
  docIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  doc: { fontSize: font.xl, fontWeight: '700', color: colors.onSurface },
  spec: { fontSize: font.base, color: colors.brandPrimary, fontWeight: '600', marginTop: 4 },
  info: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#fff', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, minHeight: 60 },
  infoLbl: { fontSize: font.sm, color: colors.muted },
  infoVal: { fontSize: font.base, color: colors.onSurface, fontWeight: '600', marginTop: 2 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.error, minHeight: 56 },
  cancelTxt: { color: colors.error, fontWeight: '700', fontSize: font.base },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheetBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xl },
  sheetHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  sheetTitle: { fontSize: font.xl, fontWeight: '700', color: colors.onSurface },
  sheetSub: { fontSize: font.sm, color: colors.muted, marginTop: 4, marginBottom: spacing.md },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.sm },
  reasonOn: { backgroundColor: colors.brandTertiary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.brandPrimary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brandPrimary },
  reasonTxt: { flex: 1, fontSize: font.base, color: colors.onSurface },
  customInput: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm, minHeight: 80, textAlignVertical: 'top', color: colors.onSurface, fontSize: font.base },
  errorTxt: { color: colors.error, fontSize: font.sm, marginTop: spacing.sm },
  sheetActions: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  sheetBack: { flex: 1, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  sheetBackTxt: { color: colors.onSurface, fontWeight: '700' },
  sheetConfirm: { flex: 2, padding: 14, borderRadius: radius.md, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  sheetConfirmTxt: { color: '#fff', fontWeight: '700', fontSize: font.base },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brandPrimary, minHeight: 56, backgroundColor: '#fff' },
  editTxt: { color: colors.brandPrimary, fontWeight: '700' },
});
