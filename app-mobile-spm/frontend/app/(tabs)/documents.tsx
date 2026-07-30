import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import dayjs from 'dayjs';
import { colors, spacing, radius, font } from '@/src/theme';
import { api } from '@/src/api';

export default function Documents() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api.listExams()); }
    catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <View style={styles.headerWithAction}>
        <Text style={styles.title}>Exames</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.brandPrimary} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-outline" size={64} color={colors.borderStrong} />
          <Text style={styles.emptyTxt}>Nenhum exame ou documento</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item }) => (
            <AccessiblePressable style={styles.card} onPress={() => router.push(`/exams/${item.id}`)} testID={`doc-card-${item.id}`}>
              <View style={[styles.icon, { backgroundColor: item.kind === 'prescription' ? colors.brandGreenSoft : colors.brandTertiary }]}>
                <Ionicons name={item.kind === 'prescription' ? 'receipt' : 'document-text'}
                  size={24} color={item.kind === 'prescription' ? colors.brandSecondary : colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>{item.doctor_name || 'Exame'} • {dayjs(item.date).format('DD/MM/YYYY')}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: item.status === 'ready' ? colors.brandGreenSoft : colors.warningSoft }]}>
                <Text style={[styles.badgeTxt, { color: item.status === 'ready' ? colors.brandSecondary : colors.warning }]}>
                  {item.status === 'ready' ? 'Pronto' : 'Aguardando'}
                </Text>
              </View>
            </AccessiblePressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  headerWithAction: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  title: { fontSize: font.xxl, fontWeight: '700', color: colors.onSurface },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#fff', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: font.base, fontWeight: '700', color: colors.onSurface },
  cardMeta: { fontSize: font.sm, color: colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyTxt: { color: colors.muted, fontSize: font.base, marginTop: spacing.md },
  noteBox: { backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  noteTitle: { fontSize: font.sm, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.xs },
  noteText: { fontSize: font.sm, color: colors.muted, lineHeight: 20 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
});
