import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { api } from '@/src/api';
import { colors, font, radius, spacing } from '@/src/theme';

export default function ChangePassword() {
  const router = useRouter();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (newPassword.length < 8) return setError('A nova senha deve ter pelo menos 8 caracteres.');
    if (newPassword !== confirmPassword) return setError('As senhas não coincidem.');
    setLoading(true);
    try {
      await api.changePassword({ email: String(email), currentPassword, newPassword });
      router.replace('/(auth)/login');
    } catch (e: any) {
      setError(e?.message || 'Não foi possível trocar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.body}>
        <Text style={styles.title}>Troque sua senha temporária</Text>
        <Text style={styles.subtitle}>Por segurança, defina uma senha nova antes do primeiro acesso.</Text>
        <Text style={styles.label}>Senha temporária</Text>
        <TextInput secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} style={styles.input} />
        <Text style={styles.label}>Nova senha</Text>
        <TextInput secureTextEntry value={newPassword} onChangeText={setNewPassword} style={styles.input} />
        <Text style={styles.label}>Confirme a nova senha</Text>
        <TextInput secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} style={styles.input} />
        {error && <Text style={styles.error}>{error}</Text>}
        <AccessiblePressable onPress={submit} disabled={loading} style={styles.button} label="Salvar nova senha">
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Salvar e entrar</Text>}
        </AccessiblePressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  body: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: font.xxl, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: font.base, marginTop: spacing.sm, marginBottom: spacing.lg },
  label: { color: colors.onSurfaceTertiary, fontSize: font.sm, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.onSurface, minHeight: 56, padding: spacing.md },
  error: { color: colors.error, marginTop: spacing.md },
  button: { alignItems: 'center', backgroundColor: colors.brandPrimary, borderRadius: radius.md, justifyContent: 'center', marginTop: spacing.xl, minHeight: 56 },
  buttonText: { color: '#fff', fontSize: font.lg, fontWeight: '700' },
});
