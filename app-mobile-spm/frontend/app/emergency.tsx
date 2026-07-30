import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '@/src/theme';
import { useAuth } from '@/src/auth';

export default function Emergency() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <View style={styles.header}>
        <AccessiblePressable onPress={() => router.back()} style={styles.back} testID="emergency-back" label="Voltar">
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </AccessiblePressable>
        <Text style={styles.title}>Cartão de Emergência</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <LinearGradient colors={[colors.brandSecondary, '#009449']} style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="medical" size={32} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardBrand}>SUS - EMERGÊNCIA</Text>
              <Text style={styles.cardSub}>Cartão digital do paciente</Text>
            </View>
          </View>

          <Text style={styles.cardName} testID="emergency-name">{user?.name || 'Paciente'}</Text>
          {user?.cpf && <Text style={styles.cardCpf}>CPF {user.cpf}</Text>}

          <View style={styles.row}>
            <Cell label="Tipo sanguíneo" value={user?.blood_type || '—'} testID="emergency-blood" />
            <Cell label="Nascimento" value={user?.birthdate || '—'} />
          </View>

          <Cell label="Contato de emergência"
            value={user?.emergency_contact ? `${user.emergency_contact} • ${user.emergency_phone || '—'}` : '—'} />

          <Text style={styles.lbl}>ALERGIAS A MEDICAMENTOS</Text>
          <View style={styles.allergies}>
            {(user?.allergies?.length ? user.allergies : ['Nenhuma registrada']).map((a: string) => (
              <View key={a} style={styles.allergyChip}>
                <Text style={styles.allergyTxt}>{a}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <Section title="Filiação">
          <InfoLine label="Mãe" value={user?.mother_name || '—'} />
          <InfoLine label="Pai" value={user?.father_name || '—'} />
        </Section>

        <Section title="Contato">
          <InfoLine label="Telefone" value={user?.phone || '—'} />
          <InfoLine label="Endereço" value={user?.address || '—'} />
          <InfoLine label="E-mail" value={user?.email || '—'} />
        </Section>

        <Section title="Documentos adicionais">
          <InfoLine label="Certidão de nascimento" value={user?.birth_certificate || '—'} />
          <InfoLine label="Certidão de casamento" value={user?.marriage_certificate || '—'} />
        </Section>

        <View style={styles.info}>
          <Ionicons name="information-circle" size={20} color={colors.brandPrimary} />
          <Text style={styles.infoTxt}>
            Mantenha suas informações atualizadas. Este cartão pode salvar sua vida em emergências.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function Cell({ label, value, testID }: any) {
  return (
    <View style={styles.col}>
      <Text style={styles.lbl}>{label}</Text>
      <Text style={styles.val} testID={testID}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: any) {
  return (
    <View style={styles.section}>
      <Text style={styles.secTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLbl}>{label}</Text>
      <Text style={styles.lineVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.onSurface },
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: { padding: spacing.lg, borderRadius: radius.lg },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md },
  cardBrand: { color: '#fff', fontSize: font.sm, fontWeight: '700', letterSpacing: 1 },
  cardSub: { color: 'rgba(255,255,255,0.85)', fontSize: font.sm },
  cardName: { color: '#fff', fontSize: font.xxl, fontWeight: '700' },
  cardCpf: { color: 'rgba(255,255,255,0.85)', fontSize: font.sm, marginTop: 2, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  col: { flex: 1 },
  lbl: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4, marginTop: 8 },
  val: { color: '#fff', fontSize: font.lg, fontWeight: '700' },
  allergies: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  allergyChip: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  allergyTxt: { color: '#fff', fontSize: font.sm, fontWeight: '600' },
  section: { backgroundColor: '#fff', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
  secTitle: { fontSize: font.sm, fontWeight: '700', color: colors.brandPrimary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  line: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.divider },
  lineLbl: { flex: 1, fontSize: font.sm, color: colors.muted, fontWeight: '600' },
  lineVal: { flex: 2, fontSize: font.base, color: colors.onSurface, fontWeight: '600' },
  info: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg },
  infoTxt: { flex: 1, fontSize: font.sm, color: colors.onSurfaceTertiary, lineHeight: 20 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.md, minHeight: 56 },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: font.lg },
});
