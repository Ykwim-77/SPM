import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, font } from '@/src/theme';
import { useAuth } from '@/src/auth';

export default function Index() {
  const { user, loading, resetSession } = useAuth();
  const router = useRouter();
  const [showEscape, setShowEscape] = useState(false);

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/(tabs)/home' : '/(auth)/login');
  }, [loading, user, router]);

  useEffect(() => {
    const t = setTimeout(() => setShowEscape(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const doReset = async () => {
    await resetSession();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.c} testID="root-index">
      <ActivityIndicator size="large" color={colors.brandPrimary} />
      <Text style={styles.txt}>Carregando…</Text>
      {showEscape && (
        <AccessiblePressable onPress={doReset} style={styles.escape} testID="reset-session-btn" label="Reiniciar sessão">
          <Text style={styles.escapeTxt}>Reiniciar sessão</Text>
        </AccessiblePressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, padding: spacing.lg },
  txt: { color: colors.muted, marginTop: spacing.md, fontSize: font.base },
  escape: { marginTop: spacing.xl, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.brandPrimary, borderRadius: radius.pill },
  escapeTxt: { color: '#fff', fontWeight: '700', fontSize: font.base },
});
