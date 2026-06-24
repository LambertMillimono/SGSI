/**
 * Teacher Dashboard — Schedule overview + quick actions
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

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const TODAY = new Date().getDay() // 0=Sun, 1=Mon…

export function TeacherDashboard({ onNavigate }: { onNavigate: (screen: string) => void }) {
  const { firstName, lastName } = useAuthStore()
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [schedule, setSchedule]     = useState<any[]>([])
  const [classes, setClasses]       = useState<any[]>([])

  const load = async () => {
    try {
      const [sch, cls] = await Promise.all([
        api.getTeacherSchedule().catch(() => ({ slots: [] })),
        api.getTeacherClasses().catch(() => ({ classes: [] })),
      ])
      setSchedule(sch?.slots ?? [])
      setClasses(cls?.classes ?? [])
    } catch (e: any) {
      Alert.alert('Erreur', e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  const todaySlots = schedule.filter(s => s.dayOfWeek === TODAY)

  const quickActions = [
    { icon: 'create-outline',   label: 'Saisir les notes',    color: colors.primary,  screen: 'GradeEntry' },
    { icon: 'calendar-outline', label: 'Absences',            color: colors.warning,  screen: 'Absences'   },
    { icon: 'time-outline',     label: 'Emploi du temps',     color: colors.info,     screen: 'Schedule'   },
    { icon: 'people-outline',   label: 'Mes classes',         color: colors.success,  screen: 'Classes'    },
  ]

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.primary} />}
    >
      {/* Greeting */}
      <View style={styles.greeting}>
        <Text style={styles.greetingSmall}>Bonjour 👋</Text>
        <Text style={styles.greetingName}>{firstName} {lastName}</Text>
      </View>

      {/* Today's schedule */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <Ionicons name="today-outline" size={16} color={colors.primary} />
          {'  '}Cours d'aujourd'hui
        </Text>
        {todaySlots.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="sunny-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>Aucun cours prévu aujourd'hui</Text>
          </View>
        ) : (
          todaySlots.map((slot, i) => (
            <View key={i} style={styles.slotCard}>
              <View style={[styles.slotTime, { backgroundColor: colors.primaryBg }]}>
                <Text style={[styles.slotTimeText, { color: colors.primary }]}>
                  {slot.startTime}
                </Text>
                <Text style={[styles.slotTimeText, { color: colors.primaryLight, fontSize: 10 }]}>
                  {slot.endTime}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.slotSubject}>{slot.subject?.name ?? '—'}</Text>
                <Text style={styles.slotClass}>{slot.class?.name ?? '—'} · {slot.room ?? ''}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Quick actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map(a => (
            <TouchableOpacity
              key={a.screen}
              style={[styles.actionCard, { borderColor: `${a.color}25` }]}
              onPress={() => onNavigate(a.screen)}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIcon, { backgroundColor: `${a.color}15` }]}>
                <Ionicons name={a.icon as any} size={22} color={a.color} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* My classes */}
      {classes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mes classes</Text>
          <View style={styles.classesWrap}>
            {classes.map((c, i) => (
              <TouchableOpacity
                key={i}
                style={styles.classChip}
                onPress={() => onNavigate('Classes')}
              >
                <Text style={styles.classChipText}>{c.name}</Text>
                <Text style={styles.classChipSub}>{c._count?.enrollments ?? 0} élèves</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bgBase },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgBase },

  greeting: { marginBottom: spacing.xl },
  greetingSmall: { ...typography.label, color: colors.textMuted },
  greetingName:  { ...typography.display, color: colors.textPrimary, marginTop: 2 },

  section: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  sectionTitle: {
    ...typography.h3, color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  /* Schedule */
  emptyBox: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { ...typography.small, color: colors.textMuted },
  slotCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  slotTime: {
    width: 56, borderRadius: radius.sm, padding: spacing.xs,
    alignItems: 'center',
  },
  slotTimeText:  { fontWeight: '700', fontSize: 13, color: colors.primary },
  slotSubject:   { ...typography.bodyBold, color: colors.textPrimary },
  slotClass:     { ...typography.small, color: colors.textMuted },

  /* Actions grid */
  actionsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  actionCard: {
    width: '47%', backgroundColor: colors.bgElevated,
    borderRadius: radius.lg, padding: spacing.lg,
    alignItems: 'center', gap: spacing.sm,
    borderWidth: 1,
  },
  actionIcon: {
    width: 48, height: 48, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: {
    ...typography.small, color: colors.textSecondary,
    textAlign: 'center', fontWeight: '600',
  },

  /* Classes */
  classesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  classChip: {
    backgroundColor: colors.primaryBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: `${colors.primary}30`,
    alignItems: 'center',
  },
  classChipText: { ...typography.bodyBold, color: colors.primary },
  classChipSub:  { ...typography.label, color: colors.primaryLight, fontSize: 9 },
})
