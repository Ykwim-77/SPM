import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
dayjs.locale('pt-br');
import { colors, spacing, radius, font } from '@/src/theme';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';
import AccessiblePressable from '@/src/components/AccessiblePressable';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [notif, setNotif] = useState<any>({ items: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, n] = await Promise.all([api.dashboard(), api.notifications()]);
      setData(d); setNotif(n);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };
  const nextApt = data?.next_appointment;
  const notifCount = notif?.items?.length || 0;
  const hasReadyExam = (data?.exams_ready ?? 0) > 0;

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Olá,</Text>
            <Text style={styles.name} testID="home-user-name">{user?.name?.split(' ')[0] || 'Paciente'}</Text>
          </View>
          <AccessiblePressable onPress={() => router.push('/notifications')} style={styles.bellBtn} testID="home-notifications-btn" label="Notificações">
            <Ionicons name="notifications" size={22} color={colors.brandPrimary} />
            {notifCount > 0 && <View style={styles.bellDot}><Text style={styles.bellDotTxt}>{notifCount > 9 ? '9+' : notifCount}</Text></View>}
          </AccessiblePressable>
          <AccessiblePressable onPress={() => router.push('/emergency')} style={styles.emergencyBtn} testID="home-emergency-btn">
            <Ionicons name="medical" size={22} color={colors.brandSecondary} />
          </AccessiblePressable>
        </View>

        <LinearGradient colors={[colors.brandPrimary, '#1E88E5']} style={styles.hero}>
          <Text style={styles.heroLabel}>PRÓXIMA CONSULTA</Text>
          {loading ? (
            <ActivityIndicator color="#fff" style={{ marginTop: spacing.md }} />
          ) : hasReadyExam ? (
            <AccessiblePressable onPress={() => router.push('/(tabs)/documents')} testID="home-ready-exam">
              <Text style={styles.heroTitle}>Novo exame pronto</Text>
              <Text style={styles.heroSub}>Abra a aba Exames para ver detalhes</Text>
              <View style={styles.heroRow}>
                <Ionicons name="document-text" size={16} color="#fff" />
                <Text style={styles.heroDate}>Exame disponível para visualização</Text>
              </View>
            </AccessiblePressable>
          ) : nextApt ? (
            <AccessiblePressable onPress={() => router.push(`/appointment/${nextApt.id}`)} testID="home-next-appointment">
              <Text style={styles.heroTitle}>{nextApt.doctor_name}</Text>
              <Text style={styles.heroSub}>{nextApt.specialty}</Text>
              <View style={styles.heroRow}>
                <Ionicons name="calendar" size={16} color="#fff" />
                <Text style={styles.heroDate}>{dayjs(nextApt.scheduled_at).format('DD [de] MMMM [às] HH:mm')}</Text>
              </View>
            </AccessiblePressable>
          ) : (
            <View>
              <Text style={styles.heroTitle}>Nenhuma consulta agendada</Text>
              <AccessiblePressable onPress={() => router.push('/appointment/book')} style={styles.heroCta} testID="home-book-cta">
                <Text style={styles.heroCtaText}>Agendar agora</Text>
              </AccessiblePressable>
            </View>
          )}
        </LinearGradient>

        <Text style={styles.section}>Atalhos</Text>
        <View style={styles.grid}>
          <Tile testID="tile-appointments" icon="calendar" label="Consultas" color={colors.brandPrimary}
            onPress={() => router.push('/(tabs)/appointments')} />
          <Tile testID="tile-documents" icon="document-text" label="Exames"
            badge={data?.exams_ready ? `${data.exams_ready} pronto${data.exams_ready > 1 ? 's' : ''}` : undefined}
            color={colors.brandSecondary} onPress={() => router.push('/(tabs)/documents')} />
          <Tile testID="tile-emergency" icon="heart" label="Emergência" color={colors.error}
            onPress={() => router.push('/emergency')} />
          <Tile testID="tile-help" icon="help-circle" label="Ajuda" color="#8B5CF6"
            onPress={() => router.push('/help')} />
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Próximas consultas" value={String(data?.upcoming_count ?? 0)} icon="calendar" color={colors.brandPrimary} />
          <StatCard label="Exames prontos" value={String(data?.exams_ready ?? 0)} icon="document-text" color={colors.brandSecondary} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ icon, label, onPress, color, badge, testID }: any) {
  return (
    <AccessiblePressable onPress={onPress} label={label} style={styles.tile} testID={testID}>
      <View style={[styles.tileIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      {badge && (
        <View style={[styles.badge, { backgroundColor: colors.brandGreenSoft }]}>
          <Text style={[styles.badgeText, { color: colors.brandSecondary }]}>{badge}</Text>
        </View>
      )}
    </AccessiblePressable>
  );
}

function StatCard({ label, value, icon, color }: any) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.lg },
  hello: { color: colors.muted, fontSize: font.base },
  name: { color: colors.onSurface, fontSize: font.xxl, fontWeight: '700' },
  bellBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 6, right: 6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  bellDotTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  emergencyBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandGreenSoft, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: font.xl, fontWeight: '700', marginTop: spacing.sm },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: font.base, marginTop: 2 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  heroDate: { color: '#fff', fontSize: font.sm, fontWeight: '600' },
  heroCta: { marginTop: spacing.md, backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.pill, alignSelf: 'flex-start' },
  heroCtaText: { color: colors.brandPrimary, fontWeight: '700' },
  section: { fontSize: font.lg, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
  tile: { width: '47%', backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, minHeight: 108 },
  tileIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  tileLabel: { fontSize: font.base, fontWeight: '600', color: colors.onSurface },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, marginTop: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  statIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  statValue: { fontSize: font.xl, fontWeight: '700', color: colors.onSurface },
  statLabel: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
});
