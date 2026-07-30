import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '@/src/theme';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';
import { formatBirthdate, toISODate } from '@/src/utils/format';

const GENDERS = ['Feminino', 'Masculino', 'Outro', 'Prefiro não dizer'];

export default function EditProfile() {
  const router = useRouter();
  const { user, refresh } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [birthdate, setBirthdate] = useState(formatBirthdate(user?.birthdate || ''));
  const [gender, setGender] = useState(user?.gender || '');
  const [photoBase64, setPhotoBase64] = useState(user?.photo_base64 || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickProfilePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permissão necessária', 'Autorize o acesso à galeria para escolher sua foto de perfil.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.length) return;
    setPhotoBase64(result.assets[0].base64 || '');
  };

  const submit = async () => {
    if (!name.trim()) { setError('Nome não pode ficar vazio.'); return; }
    if (!email.trim()) { setError('E-mail não pode ficar vazio.'); return; }
    setError(null);
    setLoading(true);
    try {
      await api.updateMe({
        name: name.trim(),
        email: email.trim(),
        phone: phone || undefined,
        address: address || undefined,
        birthdate: toISODate(birthdate) || undefined,
        gender: gender || undefined,
        photo_base64: photoBase64 || undefined,
      });
      await refresh();
      router.back();
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <View style={styles.header}>
        <AccessiblePressable onPress={() => router.back()} style={styles.back} testID="edit-back" label="Voltar">
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </AccessiblePressable>
        <Text style={styles.title}>Editar dados</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <View style={styles.photoWrap}>
            <AccessiblePressable onPress={pickProfilePhoto} style={styles.photoBtn} testID="edit-photo-btn" label="Alterar foto de perfil">
              {photoBase64 ? (
                <Image source={{ uri: `data:image/jpeg;base64,${photoBase64}` }} style={styles.photoImg} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoTxt}>{(name || user?.name || 'P').slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.photoEdit}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </AccessiblePressable>
            <Text style={styles.photoHint}>Toque na foto para alterar sua foto de perfil.</Text>
          </View>

          <SectionTitle title="Dados pessoais" />
          <Field label="Nome completo" value={name} onChangeText={setName} testID="edit-name" />
          <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" testID="edit-email" />
          <Field label="Data de nascimento (DD/MM/AAAA)" value={birthdate} onChangeText={(value) => setBirthdate(formatBirthdate(value))} testID="edit-birthdate" />

          <Text style={styles.label}>Sexo</Text>
          <View style={styles.chipsRow}>
            {GENDERS.map(g => (
              <AccessiblePressable key={g} onPress={() => setGender(g)}
                style={[styles.chip, gender === g && styles.chipOn]} testID={`gender-${g}`}>
                <Text style={[styles.chipTxt, gender === g && { color: '#fff' }]}>{g}</Text>
              </AccessiblePressable>
            ))}
          </View>

          <SectionTitle title="Contato" />
          <Field label="Telefone" value={phone} onChangeText={(value) => setPhone(formatPhone(value))} keyboardType="phone-pad" testID="edit-phone" />
          <Field label="Endereço" value={address} onChangeText={setAddress} multiline testID="edit-address" />

          {error && <Text style={styles.error} testID="edit-error">{error}</Text>}

          <AccessiblePressable style={styles.cta} onPress={submit} disabled={loading} testID="edit-submit">
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>Salvar alterações</Text>}
          </AccessiblePressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...rest }: any) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, rest.multiline && { minHeight: 72, textAlignVertical: 'top' }]}
        placeholderTextColor={colors.muted}
        {...rest}
      />
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.section}>{title}</Text>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.onSurface },
  body: { padding: spacing.lg, paddingBottom: spacing.xxl },
  photoWrap: { alignItems: 'center', marginBottom: spacing.lg },
  photoBtn: { position: 'relative' },
  photoImg: { width: 100, height: 100, borderRadius: 50 },
  photoPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  photoEdit: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.surface },
  photoHint: { fontSize: font.sm, color: colors.muted, marginTop: spacing.sm, textAlign: 'center' },
  photoActions: { flexDirection: 'row', gap: 12, marginTop: spacing.sm },
  photoActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  photoActionTxt: { fontSize: font.sm, color: colors.onSurface, fontWeight: '700' },
  photoModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  photoModalClose: { ...StyleSheet.absoluteFillObject },
  photoModalContent: { width: '90%', height: '80%' },
  photoModalImage: { width: '100%', height: '100%' },
  section: { fontSize: font.sm, fontWeight: '700', color: colors.brandPrimary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.sm },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.onSurfaceTertiary, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, fontSize: font.base, color: colors.onSurface, minHeight: 52 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipTxt: { fontSize: font.sm, color: colors.onSurface, fontWeight: '600' },
  error: { color: colors.error, marginTop: spacing.md, fontSize: font.sm },
  cta: { marginTop: spacing.xl, backgroundColor: colors.brandSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', minHeight: 56, justifyContent: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: font.lg },
});
