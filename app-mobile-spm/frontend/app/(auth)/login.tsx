import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Keyboard, TouchableWithoutFeedback } from 'react-native';
import AccessiblePressable from '@/src/components/AccessiblePressable';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, font } from '@/src/theme';
import { useAuth } from '@/src/auth';

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('demo' + String.fromCharCode(64) + 'saudepalma.com.br');
  const [password, setPassword] = useState('senha123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      if (e?.code === 'MUST_CHANGE_PASSWORD') {
        router.replace({ pathname: '/(auth)/change-password', params: { email: email.trim() } });
        return;
      }
      setError(e?.message || 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <LinearGradient colors={[colors.brandPrimary, colors.brandSecondary]} style={styles.hero}>
          <View style={styles.logo}>
            <Ionicons name="medkit" size={40} color={colors.brandPrimary} />
          </View>
          <Text style={styles.title}>Saúde na Palma da Mão</Text>
          <Text style={styles.subtitle}>Cuidar de você ficou mais fácil</Text>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Entrar</Text>

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            testID="login-email-input"
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.label}>Senha</Text>
          <View style={styles.passwordRow}>
            <TextInput
              testID="login-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="Sua senha"
              placeholderTextColor={colors.muted}
              secureTextEntry={!showPassword}
              style={[styles.input, styles.passwordInput]}
            />
            <AccessiblePressable
              testID="login-toggle-password"
              onPress={() => setShowPassword((prev) => !prev)}
              label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              style={styles.passwordToggle}
            >
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color={colors.onSurface} />
            </AccessiblePressable>
          </View>

          {error && <Text style={styles.error} testID="login-error">{error}</Text>}

          <AccessiblePressable
            testID="login-submit-button"
            onPress={submit}
            disabled={loading}
            label="Entrar"
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>Entrar</Text>
            )}
          </AccessiblePressable>

          <View style={styles.foot}>
            <Text style={styles.footTxt}>Seu cadastro é realizado pela equipe da unidade de saúde.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  hero: { paddingTop: 80, paddingBottom: 40, alignItems: 'center' },
  logo: {
    width: 80, height: 80, borderRadius: radius.lg, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  title: { color: '#fff', fontSize: font.xl, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.9)', fontSize: font.base, marginTop: 4 },
  form: { padding: spacing.lg, paddingBottom: spacing.xxl },
  heading: { fontSize: font.xxl, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.lg },
  label: { fontSize: font.sm, color: colors.onSurfaceTertiary, marginBottom: spacing.xs, marginTop: spacing.md, fontWeight: '600' },
  input: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, fontSize: font.base, color: colors.onSurface, minHeight: 56,
  },
  cta: {
    marginTop: spacing.xl, backgroundColor: colors.brandPrimary, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center', minHeight: 56, justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontSize: font.lg, fontWeight: '700' },
  error: { color: colors.error, marginTop: spacing.md, fontSize: font.sm },
  foot: { alignItems: 'center', marginTop: spacing.lg },
  footTxt: { color: colors.muted, fontSize: font.base },
  footLink: { color: colors.brandPrimary, fontWeight: '700', fontSize: font.base },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: spacing.xs },
  passwordInput: { flex: 1 },
  passwordToggle: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
});
