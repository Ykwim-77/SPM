import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, ActivityIndicator, Alert } from 'react-native';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '@/src/theme';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';

export default function ProfileSettings() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [photoRequired, setPhotoRequired] = useState(user?.medication_photo_required ?? true);
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(user?.accessibility_enabled ?? false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await api.updateMe({
        medication_photo_required: photoRequired,
        accessibility_enabled: accessibilityEnabled,
      });
      await refresh();
      Alert.alert('Salvo', 'Configuração atualizada com sucesso');
      router.push('/profile');
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <View style={styles.header}>
        <AccessiblePressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </AccessiblePressable>
        <Text style={styles.title}>Configurações</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.body}>
        <Text style={styles.section}>Remédios</Text>
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Registrar dose por foto</Text>
            <Text style={styles.settingDescription}>Se ativado, será necessário enviar foto do medicamento para registrar a dose.</Text>
          </View>
          <Switch
            value={photoRequired}
            onValueChange={setPhotoRequired}
            thumbColor={photoRequired ? colors.brandPrimary : '#fff'}
            trackColor={{ false: colors.border, true: colors.brandSecondary }}
            testID="setting-photo-required-switch"
          />
        </View>
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Modo acessibilidade</Text>
            <Text style={styles.settingDescription}>Ler em voz alta textos e assistências de navegação para usuários com baixa visão.</Text>
          </View>
          <Switch
            value={accessibilityEnabled}
            onValueChange={setAccessibilityEnabled}
            thumbColor={accessibilityEnabled ? colors.brandPrimary : '#fff'}
            trackColor={{ false: colors.border, true: colors.brandSecondary }}
            testID="setting-accessibility-switch"
          />
        </View>
        <AccessiblePressable style={styles.cta} onPress={submit} disabled={loading} testID="setting-photo-required-save">
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>Salvar configuração</Text>}
        </AccessiblePressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.onSurface },
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  section: { fontSize: font.sm, fontWeight: '700', color: colors.brandPrimary, textTransform: 'uppercase', marginBottom: spacing.md },
  settingRow: { backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  settingLabel: { fontSize: font.base, fontWeight: '700', color: colors.onSurface },
  settingDescription: { fontSize: font.sm, color: colors.muted, marginTop: spacing.xs },
  cta: { marginTop: spacing.xl, backgroundColor: colors.brandSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', minHeight: 56, justifyContent: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: font.lg },
});
