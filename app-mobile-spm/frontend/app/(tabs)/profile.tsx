import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '@/src/theme';
import { api, getActivePatientId, setActivePatientId } from '@/src/api';
import { useAuth } from '@/src/auth';

export default function Profile() {
  const { user, signOut, loggingOut, refresh } = useAuth();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [patients, setPatients] = useState<Array<{ patient_id: string; name: string; birthdate: string | null; relationship_active: boolean }>>([]);
  const [activePatientId, setActivePatientIdState] = useState<string | null>(null);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientError, setPatientError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'responsavel') return;
    let cancelled = false;
    setLoadingPatients(true);
    setPatientError(null);

    (async () => {
      try {
        const [currentPatientId, linkedPatients] = await Promise.all([
          getActivePatientId(),
          api.responsavelPatients(),
        ]);
        if (!cancelled) {
          setActivePatientIdState(currentPatientId);
          setPatients(linkedPatients || []);
        }
      } catch (error: any) {
        if (!cancelled) setPatientError(String(error?.message || 'Não foi possível carregar os pacientes vinculados.'));
      } finally {
        if (!cancelled) setLoadingPatients(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  const handleSelectPatient = async (patientId: string) => {
    try {
      await setActivePatientId(patientId);
      setActivePatientIdState(patientId);
      await refresh();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível alternar o paciente ativo.');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair da Conta?',
      'Você será desconectado. Deseja continuar?',
      [
        { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
        {
          text: 'Sair',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await signOut();
            } finally {
              setIsLoggingOut(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Perfil</Text>

        <AccessiblePressable style={styles.card} onPress={() => router.push('/profile/edit')} testID="profile-card" label="Editar perfil">
          {user?.photo_base64 ? (
            <Image source={{ uri: `data:image/jpeg;base64,${user.photo_base64}` }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>{(user?.name || 'P').slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} testID="profile-name">{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            {user?.cpf && <Text style={styles.cpf}>CPF: {user.cpf}</Text>}
          </View>
          <View style={styles.editHint}>
            <Ionicons name="create" size={16} color={colors.brandPrimary} />
            <Text style={styles.editHintTxt}>Editar</Text>
          </View>
        </AccessiblePressable>

        <Row icon="heart" color={colors.error} label="Cartão de Emergência" testID="row-emergency"
          onPress={() => router.push('/emergency')} />
        <Row icon="document-text" color={colors.brandPrimary} label="Meus Exames" testID="row-exams"
          onPress={() => router.push('/(tabs)/documents')} />
        <Row icon="notifications" color="#8B5CF6" label="Notificações" testID="row-notifications"
          onPress={() => router.push('/notifications')} />
        <Row icon="settings" color={colors.brandSecondary} label="Configurações" testID="row-settings"
          onPress={() => router.push('/profile/settings')} />
        <Row icon="help-circle" color={colors.muted} label="Ajuda" testID="row-help"
          onPress={() => router.push('/help')} />

        {user?.role === 'responsavel' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pacientes vinculados</Text>
            {loadingPatients ? (
              <Text style={styles.sectionText}>Carregando pacientes...</Text>
            ) : patientError ? (
              <Text style={[styles.sectionText, { color: colors.error }]}>{patientError}</Text>
            ) : (
              patients.map((patient) => (
                <AccessiblePressable
                  key={patient.patient_id}
                  style={[styles.patientCard, patient.patient_id === activePatientId ? styles.patientCardActive : null]}
                  onPress={() => handleSelectPatient(patient.patient_id)}
                  testID={`patient-card-${patient.patient_id}`}
                  label={`Selecionar paciente ${patient.name}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.patientName}>{patient.name}</Text>
                    <Text style={styles.patientHint}>{patient.birthdate || 'Data de nascimento desconhecida'}</Text>
                  </View>
                  {patient.patient_id === activePatientId ? (
                    <Text style={styles.patientActiveLabel}>Ativo</Text>
                  ) : (
                    <Text style={styles.patientSelectLabel}>Trocar</Text>
                  )}
                </AccessiblePressable>
              ))
            )}
          </View>
        )}

        <AccessiblePressable 
          style={[styles.logoutBtn, (isLoggingOut || loggingOut) && styles.logoutBtnDisabled]} 
          onPress={handleLogout} 
          testID="logout-button" 
          label="Sair"
          disabled={isLoggingOut || loggingOut}
        >
          <Ionicons name={isLoggingOut || loggingOut ? "hourglass" : "log-out"} size={20} color={isLoggingOut || loggingOut ? colors.muted : colors.error} />
          <Text style={[styles.logoutTxt, (isLoggingOut || loggingOut) && styles.logoutTxtDisabled]}>
            {isLoggingOut || loggingOut ? 'Saindo...' : 'Sair'}
          </Text>
        </AccessiblePressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, color, onPress, testID }: any) {
  return (
    <AccessiblePressable style={styles.row} onPress={onPress} testID={testID}>
      <View style={[styles.rowIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </AccessiblePressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { fontSize: font.xxl, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.lg },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#fff', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 60, height: 60, borderRadius: 30 },
  avatarTxt: { color: '#fff', fontSize: 24, fontWeight: '700' },
  name: { fontSize: font.lg, fontWeight: '700', color: colors.onSurface },
  email: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  cpf: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  editHint: { alignItems: 'center', gap: 2 },
  editHintTxt: { fontSize: 11, color: colors.brandPrimary, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#fff', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, minHeight: 56 },
  rowIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: font.base, color: colors.onSurface, fontWeight: '600' },
  section: { marginTop: spacing.lg, padding: spacing.md, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: font.lg, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.sm },
  sectionText: { fontSize: font.sm, color: colors.muted, marginBottom: spacing.sm },
  patientCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fafafa', marginBottom: spacing.sm },
  patientCardActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandPrimary + '10' },
  patientName: { fontSize: font.base, fontWeight: '700', color: colors.onSurface },
  patientHint: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  patientActiveLabel: { color: colors.brandPrimary, fontWeight: '700' },
  patientSelectLabel: { color: colors.brandSecondary, fontWeight: '700' },
  logoutBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: spacing.sm, 
    padding: spacing.md, 
    marginTop: spacing.lg, 
    borderRadius: radius.md, 
    borderWidth: 2, 
    borderColor: colors.error,
    backgroundColor: colors.error + '10',
    minHeight: 48,
  },
  logoutBtnDisabled: {
    backgroundColor: colors.border,
    borderColor: colors.muted,
    opacity: 0.6,
  },
  logoutTxt: { 
    color: colors.error, 
    fontWeight: '700', 
    fontSize: font.base,
  },
  logoutTxtDisabled: {
    color: colors.muted,
  },
});
