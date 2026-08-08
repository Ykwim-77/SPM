import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Linking } from 'react-native';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '@/src/theme';
import { api } from '@/src/api';

export default function Help() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const r = await api.faq(); setItems(r.items || []); }
      catch {} finally { setLoading(false); }
    })();
  }, []);

  const helpOptions = [
    {
      label: 'Ligar para Disque Saúde 136',
      icon: 'call',
      onPress: () => Linking.openURL('tel:136'),
      testID: 'help-option-call',
    },
    {
      label: 'Enviar e-mail para suporte',
      icon: 'mail',
      onPress: () => Linking.openURL('mailto:suporte@saudepalma.com.br?subject=Ajuda%20App'),
      testID: 'help-option-email',
    },
    {
      label: 'Visitar site de ajuda',
      icon: 'language',
      onPress: () => Linking.openURL('https://www.gov.br/saude/pt-br'),
      testID: 'help-option-site',
    },
    {
      label: 'Abrir central de ajuda',
      icon: 'book',
      onPress: () => Linking.openURL('https://www.gov.br/saude/pt-br'),
      testID: 'help-option-guide',
    },
  ];

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <View style={styles.header}>
        <AccessiblePressable onPress={() => router.back()} style={styles.back} testID="help-back" label="Voltar">
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </AccessiblePressable>
        <Text style={styles.title}>Ajuda</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="help-buoy" size={36} color={colors.brandPrimary} />
          </View>
          <Text style={styles.heroTitle}>Como podemos ajudar?</Text>
          <Text style={styles.heroSub}>Perguntas frequentes sobre o app</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 32 }} />
        ) : (
          items.map((f, idx) => (
            <AccessiblePressable key={idx} style={styles.faq} onPress={() => setOpenIdx(openIdx === idx ? null : idx)} testID={`faq-${idx}`} label={`Pergunta: ${f.q}`}>
              <View style={styles.faqHead}>
                <Text style={styles.faqQ}>{f.q}</Text>
                <Ionicons name={openIdx === idx ? 'chevron-up' : 'chevron-down'} size={20} color={colors.brandPrimary} />
              </View>
              {openIdx === idx && <Text style={styles.faqA}>{f.a}</Text>}
            </AccessiblePressable>
          ))
        )}

        <View style={styles.helpOptions}>
          {helpOptions.map((option) => (
            <AccessiblePressable
              key={option.testID}
              style={styles.optionBtn}
              onPress={option.onPress}
              testID={option.testID}
              label={option.label}
            >
              <Ionicons name={option.icon as any} size={20} color={colors.brandPrimary} />
              <Text style={styles.optionBtnTxt}>{option.label}</Text>
            </AccessiblePressable>
          ))}
        </View>

        <View style={styles.contact}>
          <Text style={styles.contactTitle}>Ainda precisa de ajuda?</Text>
          <AccessiblePressable style={styles.contactBtn} onPress={() => Linking.openURL('tel:136')} testID="call-sus" label="Ligar para Disque Saúde 136">
            <Ionicons name="call" size={20} color="#fff" />
            <Text style={styles.contactBtnTxt}>Ligar para Disque Saúde 136</Text>
          </AccessiblePressable>
          <AccessiblePressable style={styles.callOptionBtn} onPress={() => Linking.openURL('sms:136')} testID="sms-sus" label="Enviar SMS para Disque Saúde 136">
            <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
            <Text style={styles.callOptionBtnTxt}>Enviar SMS para 136</Text>
          </AccessiblePressable>
          <Text style={styles.contactSub}>Atendimento gratuito 24h — Ministério da Saúde</Text>
        </View>
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
  hero: { alignItems: 'center', padding: spacing.lg, backgroundColor: colors.brandTertiary, borderRadius: radius.lg, marginBottom: spacing.lg },
  heroIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  heroTitle: { fontSize: font.xl, fontWeight: '700', color: colors.onSurface },
  heroSub: { fontSize: font.base, color: colors.muted, marginTop: 4 },
  faq: { backgroundColor: '#fff', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  faqQ: { flex: 1, fontSize: font.base, fontWeight: '700', color: colors.onSurface },
  faqA: { fontSize: font.base, color: colors.onSurfaceTertiary, marginTop: spacing.sm, lineHeight: 22 },
  contact: { backgroundColor: colors.brandPrimary, padding: spacing.lg, borderRadius: radius.lg, marginTop: spacing.lg, alignItems: 'center' },
  contactTitle: { color: '#fff', fontSize: font.lg, fontWeight: '700', marginBottom: spacing.md },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.brandSecondary, paddingHorizontal: 20, paddingVertical: 14, borderRadius: radius.pill, minHeight: 48 },
  contactBtnTxt: { color: '#fff', fontWeight: '700', fontSize: font.base },
  contactSub: { color: 'rgba(255,255,255,0.85)', fontSize: font.sm, marginTop: spacing.md, textAlign: 'center' },
  callOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill, marginTop: spacing.sm },
  callOptionBtnTxt: { color: '#fff', fontWeight: '700', fontSize: font.base },
  helpOptions: { marginTop: spacing.lg },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  optionBtnTxt: { fontSize: font.base, color: colors.onSurface, fontWeight: '600' },
});
