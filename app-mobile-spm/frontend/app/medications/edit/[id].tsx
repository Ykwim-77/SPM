import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '@/src/theme';
import { api } from '@/src/api';

function formatReminderInput(value: string) {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  const hours = digits.slice(0, 2);
  const minutes = digits.slice(2, 4);
  return `${hours}:${minutes}`;
}

function parseReminderList(value: string | undefined | null) {
  if (!value) return [''];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function EditMedication() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [stock, setStock] = useState('30');
  const [notes, setNotes] = useState('');
  const [reminderTimes, setReminderTimes] = useState<string[]>(['']);

  const normalizeFrequencyCount = (value: string) => {
    const match = String(value).match(/(\d+)/);
    const count = match ? Number(match[1]) : 0;
    return Number.isFinite(count) && count > 0 ? Math.min(count, 6) : 0;
  };

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const med: any = await api.getMedication(id);
        setName(med.name || '');
        setDosage(med.dosage || '');
        setFrequency(med.frequency || '');
        setStock(String(med.stock ?? 30));
        setNotes(med.notes || '');
        setReminderTimes(parseReminderList(med.reminder_time || med.reminderTime).map((time: string) => formatReminderInput(time)));
      } catch (error) {
        Alert.alert('Erro', 'Não foi possível carregar o remédio.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    const count = normalizeFrequencyCount(frequency);
    setReminderTimes((prev) => {
      if (count === 0) return prev;
      const next = [...prev];
      while (next.length < count) next.push('');
      while (next.length > count) next.pop();
      return next;
    });
  }, [frequency]);

  const handleStockChange = (value: string) => {
    setStock(value.replace(/\D/g, ''));
  };

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert('Falta nome', 'Informe o nome do remédio.');
      return;
    }
    const stockValue = stock ? Number(stock) : 30;
    if (stock && Number.isNaN(stockValue)) {
      Alert.alert('Estoque inválido', 'Informe um número válido para estoque.');
      return;
    }
    setSaving(true);
    try {
      await api.updateMedication(id!, {
        name: name.trim(),
        dosage: dosage.trim() || undefined,
        frequency: frequency.trim() || undefined,
        stock: stockValue,
        notes: notes.trim() || undefined,
        reminder_times: reminderTimes.map(formatReminderInput).filter((time) => time.trim()),
      });
      Alert.alert('Sucesso', 'Remédio atualizado com sucesso.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao atualizar remédio');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.brandPrimary} />;

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <View style={styles.header}>
        <AccessiblePressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </AccessiblePressable>
        <Text style={styles.title}>Editar remédio</Text>
        <View style={{ width: 44 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <Text style={styles.label}>Nome</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex.: Losartana" />
          <Text style={styles.label}>Dosagem</Text>
          <TextInput style={styles.input} value={dosage} onChangeText={setDosage} placeholder="Ex.: 50mg" />
          <Text style={styles.label}>Frequência</Text>
          <TextInput style={styles.input} value={frequency} onChangeText={setFrequency} placeholder="Ex.: 2x ao dia" />
          {normalizeFrequencyCount(frequency) > 0 && (
            <>
              <Text style={styles.label}>Horários</Text>
              {reminderTimes.map((time, index) => (
                <TextInput
                  key={index}
                  style={styles.input}
                  value={time}
                  onChangeText={(value) => setReminderTimes((prev) => prev.map((item, idx) => idx === index ? formatReminderInput(value) : item))}
                  placeholder="HH:MM"
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              ))}
            </>
          )}
          <Text style={styles.label}>Estoque</Text>
          <TextInput style={styles.input} value={stock} onChangeText={handleStockChange} keyboardType="numeric" placeholder="30" />
          <Text style={styles.label}>Observações</Text>
          <TextInput style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline placeholder="Informações úteis" />
          <AccessiblePressable style={styles.cta} onPress={submit} disabled={saving}>
            <Text style={styles.ctaTxt}>{saving ? 'Salvando...' : 'Salvar alterações'}</Text>
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
  title: { fontSize: font.lg, fontWeight: '700', color: colors.onSurface },
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.onSurfaceTertiary, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: font.base, color: colors.onSurface, minHeight: 52 },
  cta: { marginTop: spacing.xl, backgroundColor: colors.brandSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', minHeight: 56, justifyContent: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: font.lg },
});
