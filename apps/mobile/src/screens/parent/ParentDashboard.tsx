/**
 * Parent Dashboard — Overview of child's academic performance
 */

import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../api/client'
import { useAuthStore } from '../../store/auth.store'
import { colors, spacing, radius, typography } from '../../utils/theme'

interface GradeItem {
  subjectName: string
  coefficient: number
  average: number | null
}

interface GradeData {
  subjectAverages: GradeItem[]
  generalAverage: number | null
  period: number
}

interface AbsenceData {
  counts: { total: number; justified: number; unjustified: number }
}

interface PaymentItem {
  amount: number
  paidAt: string
  feeType: { name: string }
  receiptNo: string
}

export function ParentDashboard({ studentId }: { studentId: string }) {
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod]         = useState(1)
  const [grades, setGrades]         = useState<GradeData | null>(null)
  const [absences, setAbsences]     = useState<AbsenceData | null>(null)
  const [payments, setPayments]     = useState<PaymentItem[]>([])

  const load = async () => {
    try {
      const [g, a, p] = await Promise.all([
        api.getStudentGrades(studentId, period).catch(() => null),
        api.getStudentAbsences(studentId).catch(() => null),
        api.getStudentPayments(studentId).catch(() => ({ payments: [] })),
      ])
      setGrades(g)
      setAbsences(a)
      setPayments(p?.payments ?? [])
    } catch (e: any) {
      Alert.alert('Erreur', e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [studentId, period])

  const onRefresh = () => { setRefreshing(true); load() }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText]}>Chargement...</Text>
      </View>
    )
  }

  const avg = grades?.generalAverage ?? null
  const avgColor = avg === null ? colors.textMuted
    : avg >= 12 ? colors.success
    : avg >= 8  ? colors.warning
    : colors.danger

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Period selector */}
      <View style={styles.periodRow}>
        {[1, 2, 3].map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              Trim. {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* General average — hero card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Moyenne générale</Text>
        <Text style={[styles.heroAvg, { color: avgColor }]}>
          {avg !== null ? avg.toFixed(2) : '—'}
          {avg !== null && <Text style={styles.heroAvgSub}> /20</Text>}
        </Text>
        <Text style={styles.heroSub}>
          {avg === null ? 'Notes non encore saisies'
            : avg >= 16 ? '🏆 Excellent'
            : avg >= 14 ? '⭐ Très bien'
            : avg >= 12 ? '✅ Bien'
            : avg >= 10 ? '📘 Passable'
            : avg >= 8  ? '⚠️ Insuffisant'
            : '❌ En difficulté'}
        </Text>
      </View>

      {/* KPI row */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Ionicons name="book-outline" size={20} color={colors.primary} style={styles.kpiIcon} />
          <Text style={styles.kpiValue}>{grades?.subjectAverages?.length ?? 0}</Text>
          <Text style={styles.kpiLabel}>Matières</Text>
        </View>
        <View style={styles.kpiCard}>
          <Ionicons name="calendar-outline" size={20} color={colors.danger} style={styles.kpiIcon} />
          <Text style={styles.kpiValue}>{absences?.counts?.total ?? 0}</Text>
          <Text style={styles.kpiLabel}>Absences</Text>
        </View>
        <View style={styles.kpiCard}>
          <Ionicons name="cash-outline" size={20} color={colors.success} style={styles.kpiIcon} />
          <Text style={styles.kpiValue}>{payments.length}</Text>
          <Text style={styles.kpiLabel}>Paiements</Text>
        </View>
      </View>

      {/* Grades by subject */}
      {grades?.subjectAverages && grades.subjectAverages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes par matière</Text>
          {grades.subjectAverages.map((s, i) => {
            const sColor = s.average === null ? colors.textMuted
              : s.average >= 12 ? colors.success
              : s.average >= 8  ? colors.warning
              : colors.danger
            return (
              <View key={i} style={styles.gradeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subjectName}>{s.subjectName}</Text>
                  <Text style={styles.coefText}>Coeff. {s.coefficient}</Text>
                </View>
                <View style={[styles.avgBadge, { backgroundColor: `${sColor}18`, borderColor: `${sColor}30` }]}>
                  <Text style={[styles.avgBadgeText, { color: sColor }]}>
                    {s.average !== null ? s.average.toFixed(2) : '—'}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>
      )}

      {/* Absences detail */}
      {absences && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Absences</Text>
          <View style={styles.absenceGrid}>
            {[
              { label: 'Total',        value: absences.counts.total,        color: colors.textSecondary },
              { label: 'Justifiées',   value: absences.counts.justified,    color: colors.warning },
              { label: 'Non justif.', value: absences.counts.unjustified,  color: colors.danger },
            ].map(({ label, value, color }) => (
              <View key={label} style={styles.absenceCard}>
                <Text style={[styles.absenceValue, { color }]}>{value}</Text>
                <Text style={styles.absenceLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Recent payments */}
      {payments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paiements récents</Text>
          {payments.slice(0, 5).map((p, i) => (
            <View key={i} style={styles.paymentRow}>
              <View style={styles.paymentIcon}>
                <Ionicons name="receipt-outline" size={16} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentFee}>{p.feeType?.name}</Text>
                <Text style={styles.paymentDate}>
                  {new Date(p.paidAt).toLocaleDateString('fr-FR')} · {p.receiptNo}
                </Text>
              </View>
              <Text style={styles.paymentAmount}>
                {p.amount.toLocaleString('fr-FR')} GNF
              </Text>
            </View>
          ))}
          <View style={styles.paymentTotal}>
            <Text style={styles.paymentTotalLabel}>Total payé</Text>
            <Text style={styles.paymentTotalValue}>
              {totalPaid.toLocaleString('fr-FR')} GNF
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.bgBase },
  content:      { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgBase },
  loadingText:  { ...typography.small, color: colors.textMuted, marginTop: spacing.md },

  /* Period */
  periodRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  periodBtn: {
    flex: 1, paddingVertical: spacing.sm,
    borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  periodText:      { ...typography.small, color: colors.textMuted, fontWeight: '600' },
  periodTextActive:{ color: '#fff' },

  /* Hero */
  heroCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.xl, padding: spacing.xxl,
    alignItems: 'center', marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  heroLabel:   { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm },
  heroAvg:     { fontSize: 52, fontWeight: '900', letterSpacing: -2 },
  heroAvgSub:  { fontSize: 22, fontWeight: '400' },
  heroSub:     { ...typography.small, color: colors.textSecondary, marginTop: spacing.sm },

  /* KPIs */
  kpiRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  kpiCard: {
    flex: 1, backgroundColor: colors.bgSurface,
    borderRadius: radius.lg, padding: spacing.lg,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  kpiIcon:  { marginBottom: spacing.xs },
  kpiValue: { ...typography.h2, color: colors.textPrimary },
  kpiLabel: { ...typography.label, color: colors.textMuted, textAlign: 'center' },

  /* Section */
  section: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  sectionTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md },

  /* Grades */
  gradeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  subjectName: { ...typography.bodyBold, color: colors.textPrimary },
  coefText:    { ...typography.small, color: colors.textMuted },
  avgBadge: {
    width: 56, height: 32, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  avgBadgeText: { fontSize: 13, fontWeight: '700' },

  /* Absences */
  absenceGrid:  { flexDirection: 'row', gap: spacing.sm },
  absenceCard:  {
    flex: 1, backgroundColor: colors.bgElevated,
    borderRadius: radius.md, padding: spacing.md,
    alignItems: 'center',
  },
  absenceValue: { fontSize: 22, fontWeight: '800' },
  absenceLabel: { ...typography.label, color: colors.textMuted, textAlign: 'center', marginTop: 2 },

  /* Payments */
  paymentRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  paymentIcon: {
    width: 34, height: 34, borderRadius: radius.sm,
    backgroundColor: colors.successBg,
    alignItems: 'center', justifyContent: 'center',
  },
  paymentFee:    { ...typography.bodyBold, color: colors.textPrimary },
  paymentDate:   { ...typography.small, color: colors.textMuted },
  paymentAmount: { ...typography.bodyBold, color: colors.success },
  paymentTotal: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: spacing.md, marginTop: spacing.sm,
  },
  paymentTotalLabel: { ...typography.label, color: colors.textMuted },
  paymentTotalValue: { ...typography.bodyBold, color: colors.success },
})
