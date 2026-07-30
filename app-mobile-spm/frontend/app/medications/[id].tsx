import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { colors, spacing, radius, font } from '@/src/theme';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';

export default function MedicationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [med, setMed] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setMed(await api.getMedication(id!)); }
    catch {} finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const [photo, setPhoto] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const { user } = useAuth();
  const photoRequired = user?.medication_photo_required ?? true;

  const takeMedicationPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão negada', 'Autorize o acesso à câmera para tirar a foto do medicamento.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });
    if (!r.canceled && r.assets?.[0]?.base64) setPhoto(r.assets[0].base64);
  };

  const takeDose = async () => {
    if (photoRequired && !photo) {
      Alert.alert('Foto necessária', 'Tire ou escolha uma foto da caixa/cartela antes de registrar a dose.');
      return;
    }
    setVerifying(true);
    try {
      if (photo) {
        const verify = await api.verifyMedicationPhoto(id!, photo);
        if (!verify?.verified) {
          Alert.alert('Verificação falhou', verify?.message || 'A imagem não foi identificada como medicamento.');
          return;
        }
      }
      await api.takeMedication(id!, photo ?? undefined);
      setPhoto(null);
      await load();
      Alert.alert('Registro', 'Dose registrada com sucesso.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao registrar dose');
    } finally {
      setVerifying(false);
    }
  };

  const deleteMed = async () => {
    try {
      await api.deleteMedication(id!);
      router.back();
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao apagar medicamento');
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.brandPrimary} />;
  if (!med) return <Text style={{ padding: 24 }}>Medicamento não encontrado</Text>;

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <View style={styles.header}>
        <AccessiblePressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </AccessiblePressable>
        <Text style={styles.title}>{med.name}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <View style={styles.rowHeader}>
            <Text style={styles.titleLabel}>Dados do remédio</Text>
            <AccessiblePressable style={styles.editBtn} onPress={() => router.push(`/medications/edit/${id}`)} testID="med-edit-btn">
              <Ionicons name="pencil" size={16} color={colors.brandPrimary} />
              <Text style={styles.editBtnTxt}>Editar</Text>
            </AccessiblePressable>
          </View>
          <Text style={styles.label}>Dosagem</Text>
          <Text style={styles.value}>{med.dosage || '—'}</Text>
          <Text style={styles.label}>Frequência</Text>
          <Text style={styles.value}>{med.frequency || '—'}</Text>
          <Text style={styles.label}>Estoque</Text>
          <Text style={styles.value}>{med.stock}</Text>
          {med.notes ? (
            <>
              <Text style={styles.label}>Observações</Text>
              <Text style={styles.value}>{med.notes}</Text>
            </>
          ) : null}
          <Text style={styles.label}>Foto de verificação</Text>
          <Text style={styles.helpText}>{photoRequired ? 'Foto obrigatória para registrar a dose. Use a câmera para tirar a foto agora.' : 'Foto opcional. Use a câmera para tirar a foto no momento do registro.'}</Text>
          <View style={styles.photoActions}>
            <AccessiblePressable style={styles.photoBtn} onPress={takeMedicationPhoto} label="Tirar foto" testID="med-camera-btn">
              <Ionicons name="camera" size={20} color={colors.onSurface} />
              <Text style={styles.photoBtnTxt}>Tirar foto</Text>
            </AccessiblePressable>
          </View>
          {photo ? (
            <>
              <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={styles.photoPreview} />
              <Text style={styles.photoHint}>Foto pronta para verificação</Text>
            </>
          ) : null}
        </View>
        <AccessiblePressable style={[styles.cta, photoRequired && !photo ? styles.ctaDisabled : null]} onPress={takeDose} label="Registrar dose" testID="med-register-dose" disabled={(photoRequired && !photo) || verifying}>
          <Text style={styles.ctaTxt}>{verifying ? 'Verificando...' : 'Registrar dose'}</Text>
        </AccessiblePressable>
        <AccessiblePressable style={styles.deleteBtn} onPress={deleteMed} label="Remover da lista" testID="med-delete">
          <Text style={styles.deleteTxt}>Remover da lista</Text>
        </AccessiblePressable>
        {med.logs?.length ? (
          <View style={styles.card}>
            <Text style={styles.label}>Histórico</Text>
            {med.logs.map((log:any) => (
              <View key={log.id} style={styles.historyItem}>
                <Text style={styles.value}>{new Date(log.taken_at).toLocaleString('pt-BR')}</Text>
                {log.photo_base64 ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${log.photo_base64}` }} style={styles.historyImage} />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
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
  card: { backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  label: { fontSize: font.sm, fontWeight: '700', color: colors.brandPrimary, marginTop: spacing.sm },
  value: { fontSize: font.base, color: colors.onSurface, marginTop: 4 },
  cta: { backgroundColor: colors.brandSecondary, padding: spacing.md, borderRadius: radius.md, alignItems: 'center', minHeight: 56, justifyContent: 'center' },
  ctaDisabled: { backgroundColor: colors.border },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: font.lg },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  photoBtnTxt: { color: colors.onSurface, fontWeight: '700' },
  photoPreview: { marginTop: spacing.sm, width: '100%', height: 180, borderRadius: radius.md, backgroundColor: colors.borderStrong },
  photoHint: { marginTop: spacing.sm, color: colors.muted },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  titleLabel: { fontSize: font.base, fontWeight: '700', color: colors.onSurface },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brandPrimary },
  editBtnTxt: { color: colors.brandPrimary, fontWeight: '700', fontSize: font.sm },
  photoActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  historyItem: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  historyImage: { marginTop: spacing.sm, width: '100%', height: 180, borderRadius: radius.md, backgroundColor: colors.borderStrong },
  deleteBtn: { marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.error, alignItems: 'center' },
  deleteTxt: { color: colors.error, fontWeight: '700' },
  helpText: { color: colors.muted, fontSize: font.sm, marginTop: spacing.sm },
});
