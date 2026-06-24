/**
 * ConnectScreen — First screen the user sees.
 * Step 1: Enter the desktop IP address (server discovery)
 * Step 2: Login with username + password
 */

import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Alert,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth.store'
import { colors, spacing, radius, typography } from '../utils/theme'

export function ConnectScreen() {
  const login = useAuthStore(s => s.login)

  const [step, setStep]           = useState<'server' | 'login'>('server')
  const [serverIp, setServerIp]   = useState('')
  const [username, setUsername]   = useState('')
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [serverInfo, setServerInfo] = useState<{ name: string } | null>(null)

  /* ── Step 1: Verify server ─────────────────────────────── */
  const handleCheckServer = async () => {
    const ip = serverIp.trim()
    if (!ip) return Alert.alert('Erreur', 'Entrez l\'adresse IP du serveur')
    setLoading(true)
    try {
      const info = await api.checkServer(ip)
      setServerInfo(info)
      setStep('login')
    } catch {
      Alert.alert(
        'Connexion impossible',
        `Impossible de joindre le serveur à l'adresse ${ip}:3721.\n\n` +
        '• Vérifiez que l\'application SGSI Desktop est ouverte\n' +
        '• Vérifiez que votre téléphone est sur le même réseau Wi-Fi\n' +
        '• Vérifiez l\'adresse IP (ex: 192.168.1.10)'
      )
    } finally {
      setLoading(false)
    }
  }

  /* ── Step 2: Login ─────────────────────────────────────── */
  const handleLogin = async () => {
    if (!username.trim() || !password) {
      return Alert.alert('Erreur', 'Identifiant et mot de passe requis')
    }
    setLoading(true)
    try {
      await login(serverIp.trim(), username.trim(), password)
    } catch (e: any) {
      Alert.alert('Connexion refusée', e.message ?? 'Identifiants incorrects')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo / Header */}
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>S</Text>
          </View>
          <Text style={styles.logoTitle}>SGSI</Text>
          <Text style={styles.logoSub}>SchoolManager Pro · Mobile</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {step === 'server' ? (
            <>
              <Text style={styles.cardTitle}>Connexion au serveur</Text>
              <Text style={styles.cardDesc}>
                Entrez l'adresse IP de l'ordinateur qui fait tourner SGSI Desktop.
                Les deux appareils doivent être sur le même réseau Wi-Fi.
              </Text>

              <Text style={styles.label}>Adresse IP du serveur</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 192.168.1.10"
                placeholderTextColor={colors.textMuted}
                value={serverIp}
                onChangeText={setServerIp}
                keyboardType="numeric"
                autoComplete="off"
                returnKeyType="done"
                onSubmitEditing={handleCheckServer}
              />

              <View style={styles.helpBox}>
                <Text style={styles.helpTitle}>Comment trouver l'adresse IP ?</Text>
                <Text style={styles.helpText}>
                  Sur l'ordinateur SGSI : ouvrez un terminal et tapez {'\n'}
                  Windows: <Text style={styles.helpCode}>ipconfig</Text>{'\n'}
                  → cherchez "Adresse IPv4"
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleCheckServer}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Vérifier la connexion →</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.serverBadge}>
                <View style={styles.serverDot} />
                <Text style={styles.serverBadgeText}>Connecté à {serverIp}</Text>
              </View>

              <Text style={styles.cardTitle}>Identification</Text>
              <Text style={styles.cardDesc}>
                {serverInfo?.name ?? 'SGSI'} · Entrez vos identifiants
              </Text>

              <Text style={styles.label}>Identifiant</Text>
              <TextInput
                style={styles.input}
                placeholder="Nom d'utilisateur ou matricule"
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoComplete="username"
                returnKeyType="next"
              />

              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Mot de passe"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPass(v => !v)}
                >
                  <Text style={styles.eyeText}>{showPass ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Se connecter</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => { setStep('server'); setUsername(''); setPassword('') }}
              >
                <Text style={styles.backBtnText}>← Changer de serveur</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.footer}>SGSI v1.0 · SchoolManager Pro</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['4xl'],
  },

  /* Header */
  header: { alignItems: 'center', marginBottom: spacing['3xl'] },
  logoMark: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  logoLetter: { color: '#fff', fontSize: 32, fontWeight: '900' },
  logoTitle:  { ...typography.display, color: colors.textPrimary },
  logoSub:    { ...typography.small, color: colors.textMuted, marginTop: 4 },

  /* Card */
  card: {
    width: '100%',
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm,
  },
  cardDesc: {
    ...typography.small, color: colors.textSecondary,
    lineHeight: 18, marginBottom: spacing.xl,
  },

  /* Server badge */
  serverBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.successBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    alignSelf: 'flex-start', marginBottom: spacing.lg,
  },
  serverDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: colors.success, marginRight: spacing.sm,
  },
  serverBadgeText: { ...typography.small, color: colors.success, fontWeight: '600' },

  /* Form */
  label: { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 14, marginBottom: spacing.lg,
  },
  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 52 },
  eyeBtn: {
    position: 'absolute', right: 14, top: 13,
    width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  eyeText: { fontSize: 16 },

  /* Help box */
  helpBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  helpTitle: { ...typography.label, color: colors.primary, marginBottom: spacing.xs },
  helpText:  { ...typography.small, color: colors.textSecondary, lineHeight: 18 },
  helpCode:  { fontFamily: 'monospace', color: colors.primaryLight, fontWeight: '600' },

  /* Buttons */
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md + 2,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
  backBtn:     { alignItems: 'center', marginTop: spacing.md },
  backBtnText: { ...typography.small, color: colors.textMuted },

  footer: {
    ...typography.small, color: colors.textDisabled,
    marginTop: spacing.xxl, textAlign: 'center',
  },
})
