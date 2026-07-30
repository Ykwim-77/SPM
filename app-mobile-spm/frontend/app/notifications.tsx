import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
dayjs.locale('pt-br');
import { colors, spacing, radius, font } from '@/src/theme';
import { api } from '@/src/api';

type Notif = {
  id: string;
  kind: string;
  icon: string;
  title: string;
  body: string;
  when: string;
  remaining_text?: string;
  link?: string;
};

const KIND_COLOR: Record<string, string> = {
  appointment: '#0066CC',
  exam: '#00A650',
  medication: '#0B6E4F',
  profile: '#F59E0B',
};

export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.notifications(); setItems(r.items || []); }
    catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <View style={styles.header}>
        <AccessiblePressable onPress={() => router.back()} style={styles.back} testID="notif-back" label="Voltar">
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </AccessiblePressable>
        <Text style={styles.title}>Notificações</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.brandPrimary} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-off-outline" size={64} color={colors.borderStrong} />
          <Text style={styles.emptyTxt}>Você está em dia! Nenhuma notificação por enquanto.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item }) => {
            const c = KIND_COLOR[item.kind] || colors.brandPrimary;
            return (
              <AccessiblePressable
                style={styles.card}
                onPress={() => item.link && router.push(item.link as any)}
                testID={`notif-${item.id}`}
              >
                <View style={[styles.icon, { backgroundColor: c + '20' }]}>
                  <Ionicons name={item.icon as any} size={22} color={c} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardBody}>{item.body}</Text>
                  <Text style={styles.cardWhen}>{dayjs(item.when).format('DD/MM [às] HH:mm')}</Text>
                  {item.remaining_text ? <Text style={styles.cardRemaining}>{item.remaining_text}</Text> : null}
                </View>
                {item.link && <Ionicons name="chevron-forward" size={20} color={colors.muted} />}
              </AccessiblePressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.onSurface },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#fff', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: font.base, fontWeight: '700', color: colors.onSurface },
  cardBody: { fontSize: font.sm, color: colors.onSurfaceTertiary, marginTop: 2 },
  cardWhen: { fontSize: 11, color: colors.muted, marginTop: 4 },
  cardRemaining: { fontSize: 11, color: colors.brandSecondary, marginTop: 2, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: spacing.lg },
  emptyTxt: { color: colors.muted, fontSize: font.base, marginTop: spacing.md, textAlign: 'center' },
});
