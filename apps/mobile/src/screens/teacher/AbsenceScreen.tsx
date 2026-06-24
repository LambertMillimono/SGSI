/**
 * AbsenceScreen — Teacher marks attendance for a class
 */

import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../api/client'
import { colors, spacing, radius, typography } from '../../utils/theme'

type Status = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'

interface StudentAttendance {
  id: string
  firstName: string
  lastName: string
  matricule: string
  enrollmentId: string
  status: Status
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: string }> = {
  PRESENT: { label: 'Présent',  color: colors.success, icon: 'checkmark-circle' },
  ABSENT:  { label: 'Absent',   color: colors.danger,  icon: 'close-circle'    },
  LATE:    { label: 'Retard',   color: colors.warning, icon: 'time'            },
  EXCUSED: { label: 'Justifié', color: colors.info,    icon: 'information-circle' },
}
const STATUS_CYCLE: Status[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']

const today = new Date().toISOString().split('T')[0]

export function AbsenceScreen({ onBack }: { onBack: () => void }) {
  const [classes, setClasses]   = useState<any[]>([])
  const [students, setStudents] = useState<StudentAttendance[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [selectedClass, setSelectedClass] = useState<string | null>(null)

  useEffect(() => {
    api.getTeacherClasses()
      .then(r => { setClasses(r?.classes ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const loadStudents = async (classId: string) => {
    setLoading(true)
    try {
      const r = await api.getClassStudents(classId)
      setStudents(
        (r?.students ?? []).map((s: any) => ({ ...s, status: 'PRESENT' as Status }))
      )
    } finally {
      setLoading(false)
    }
  }

  const cycleStatus = (enrollmentId: string) => {
    setStudents(prev => prev.map(s => {
      if (s.enrollmentId !== enrollmentId) return s
      const idx = STATUS_CYCLE.indexOf(s.status)
      return { ...s, status: STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length] }
    }))
  }

  const setAllPresent = () =>
    setStudents(prev => prev.map(s => ({ ...s, status: 'PRESENT' })))

  const handleSave = async () => {
    if (!selectedClass) return
    setSaving(true)
    try {
      const absences = students
        .filter(s => s.status !== 'PRESENT')
        .map(s => ({
          enrollmentId: s.enrollmentId,
          date:  today,
          type:  s.status === 'EXCUSED' ? 'JUSTIFIED' : s.status === 'LATE' ? 'LATE' : 'UNJUSTIFIED',
          note:  '',
        }))

      await api.saveAbsences({ absences })
      const absentCount = students.filter(s => s.status !== 'PRESENT').length
      Alert.alert(
        'Enregistré',
        absentCount > 0
          ? `${absentCount} absence(s) enregistrée(s) pour aujourd'hui.`
          : 'Tous les élèves sont marqués présents.',
        [{ text: 'OK', onPress: onBack }]
      )
    } catch (e: any) {
      Alert.alert('Erreur', e.message)
    } finally {
      setSaving(false)
    }
  }

  const absentCount  = students.filter(s => s.status === 'ABSENT').length
  const presentCount = students.filter(s => s.status === 'PRESENT').length

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Absences du jour</Text>
          <Text style={styles.headerDate}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || !selectedClass}
          style={[styles.saveBtn, (!selectedClass || saving) && styles.saveBtnDisabled]}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveBtnText}>Valider</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Class chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classScroll}>
        <View style={styles.classRow}>
          {classes.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.classChip, selectedClass === c.id && styles.classChipActive]}
              onPress={() => { setSelectedClass(c.id); loadStudents(c.id) }}
            >
              <Text style={[styles.classChipText, selectedClass === c.id && styles.classChipTextActive]}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {selectedClass && students.length > 0 && (
        <>
          {/* Stats bar */}
          <View style={styles.statsBar}>
            <Text style={[styles.statText, { color: colors.success }]}>✓ {presentCount} présent(s)</Text>
            <Text style={[styles.statText, { color: colors.danger }]}>✗ {absentCount} absent(s)</Text>
            <TouchableOpacity onPress={setAllPresent} style={styles.allPresentBtn}>
              <Text style={styles.allPresentText}>Tous présents</Text>
            </TouchableOpacity>
          </View>

          {/* Status legend */}
          <View style={styles.legend}>
            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
              <View key={status} style={styles.legendItem}>
                <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
                <Text style={[styles.legendText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            ))}
            <Text style={styles.legendHint}>Tapez pour changer</Text>
          </View>
        </>
      )}

      {/* Student list */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
        ) : !selectedClass ? (
          <View style={styles.emptyBox}>
            <Ionicons name="school-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>Sélectionnez une classe</Text>
          </View>
        ) : students.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>Aucun élève dans cette classe</Text>
          </View>
        ) : (
          students.map((s, i) => {
            const cfg = STATUS_CONFIG[s.status]
            return (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.studentRow,
                  i % 2 === 0 && styles.studentRowAlt,
                  { borderLeftColor: cfg.color, borderLeftWidth: 3 },
                ]}
                onPress={() => cycleStatus(s.enrollmentId)}
                activeOpacity={0.7}
              >
                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: `${cfg.color}18` }]}>
                  <Text style={[styles.avatarText, { color: cfg.color }]}>
                    {s.lastName[0]}{s.firstName[0]}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{s.lastName} {s.firstName}</Text>
                  <Text style={styles.studentId}>{s.matricule}</Text>
                </View>

                {/* Status badge */}
                <View style={[styles.statusBadge, { backgroundColor: `${cfg.color}15`, borderColor: `${cfg.color}30` }]}>
                  <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
                  <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgSurface,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:      { padding: spacing.xs, marginRight: spacing.md },
  headerTitle:  { ...typography.h3, color: colors.textPrimary },
  headerDate:   { ...typography.small, color: colors.textMuted },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText:     { color: '#fff', fontWeight: '700', fontSize: 13 },

  classScroll: { maxHeight: 52, backgroundColor: colors.bgSurface, borderBottomWidth: 1, borderBottomColor: colors.border },
  classRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.sm },
  classChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  classChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  classChipText:   { ...typography.small, color: colors.textMuted, fontWeight: '600' },
  classChipTextActive: { color: '#fff' },

  statsBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bgSurface, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  statText: { ...typography.small, fontWeight: '700' },
  allPresentBtn: {
    marginLeft: 'auto', backgroundColor: colors.successBg,
    borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  allPresentText: { ...typography.label, color: colors.success, fontSize: 10 },

  legend: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.xs,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendText: { fontSize: 10, fontWeight: '600' },
  legendHint: { ...typography.label, color: colors.textDisabled, fontSize: 9, marginLeft: 'auto' },

  studentRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    borderRadius: radius.md, marginBottom: spacing.xs,
    paddingLeft: spacing.md,
  },
  studentRowAlt: { backgroundColor: colors.bgSurface },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:    { fontSize: 12, fontWeight: '700' },
  studentName:   { ...typography.bodyBold, color: colors.textPrimary },
  studentId:     { ...typography.small, color: colors.textMuted },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: radius.full, borderWidth: 1,
  },
  statusText:  { fontSize: 11, fontWeight: '700' },

  emptyBox:  { alignItems: 'center', paddingVertical: spacing['4xl'], gap: spacing.md },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
})
