/**
 * GradeEntryScreen — Teacher enters grades for a class/subject/period
 */

import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../api/client'
import { colors, spacing, radius, typography } from '../../utils/theme'

interface Student {
  id: string
  firstName: string
  lastName: string
  matricule: string
  enrollmentId: string
}

interface GradeInput {
  enrollmentId: string
  ds1: string
  ds2: string
  composition: string
}

const EVAL_TYPES = ['ds1', 'ds2', 'composition'] as const
const EVAL_LABELS: Record<string, string> = { ds1: 'DS1', ds2: 'DS2', composition: 'Compo.' }

export function GradeEntryScreen({ onBack }: { onBack: () => void }) {
  const [classes, setClasses]       = useState<any[]>([])
  const [subjects, setSubjects]     = useState<any[]>([])
  const [students, setStudents]     = useState<Student[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [selectedClass, setSelectedClass]   = useState<string | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [period, setPeriod]         = useState(1)
  const [grades, setGrades]         = useState<Record<string, GradeInput>>({})

  useEffect(() => {
    api.getTeacherClasses()
      .then(r => {
        setClasses(r?.classes ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const loadStudents = async (classId: string) => {
    setLoading(true)
    try {
      const r = await api.getClassStudents(classId)
      const list: Student[] = r?.students ?? []
      setStudents(list)
      // Initialize grades map
      const initial: Record<string, GradeInput> = {}
      list.forEach(s => {
        initial[s.enrollmentId] = { enrollmentId: s.enrollmentId, ds1: '', ds2: '', composition: '' }
      })
      setGrades(initial)
    } catch (e: any) {
      Alert.alert('Erreur', e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClassSelect = (classId: string) => {
    setSelectedClass(classId)
    loadStudents(classId)
  }

  const updateGrade = (enrollmentId: string, field: string, value: string) => {
    const num = value.replace(',', '.')
    if (num && (isNaN(Number(num)) || Number(num) < 0 || Number(num) > 20)) return
    setGrades(prev => ({
      ...prev,
      [enrollmentId]: { ...prev[enrollmentId], [field]: num },
    }))
  }

  const handleSave = async () => {
    if (!selectedClass || !selectedSubject) {
      Alert.alert('Erreur', 'Sélectionnez une classe et une matière')
      return
    }
    setSaving(true)
    try {
      const payload: any[] = []
      Object.values(grades).forEach(g => {
        EVAL_TYPES.forEach(type => {
          const val = g[type]
          if (val !== '') {
            payload.push({
              enrollmentId: g.enrollmentId,
              subjectId:    selectedSubject,
              period,
              type:         type.toUpperCase(),
              score:        Number(val),
            })
          }
        })
      })
      if (payload.length === 0) {
        Alert.alert('Aucune note', 'Entrez au moins une note')
        setSaving(false)
        return
      }
      await api.saveGrades('', period, payload)
      Alert.alert('Succès', `${payload.length} note(s) enregistrée(s)`, [
        { text: 'OK', onPress: onBack },
      ])
    } catch (e: any) {
      Alert.alert('Erreur', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bgBase }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saisie des notes</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveBtnText}>Enregistrer</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>

        {/* Period */}
        <Text style={styles.label}>Période</Text>
        <View style={styles.periodRow}>
          {[1, 2, 3].map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                Trimestre {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Class selector */}
        <Text style={styles.label}>Classe</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {classes.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, selectedClass === c.id && styles.chipActive]}
                onPress={() => handleClassSelect(c.id)}
              >
                <Text style={[styles.chipText, selectedClass === c.id && styles.chipTextActive]}>
                  {c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Student grade table */}
        {selectedClass && students.length > 0 && (
          <>
            {/* Column headers */}
            <View style={styles.tableHeader}>
              <Text style={[styles.thCell, { flex: 2 }]}>Élève</Text>
              {EVAL_TYPES.map(t => (
                <Text key={t} style={styles.thCell}>{EVAL_LABELS[t]}</Text>
              ))}
            </View>

            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
            ) : (
              students.map((student, i) => (
                <View key={student.id} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.studentName} numberOfLines={1}>
                      {student.lastName} {student.firstName}
                    </Text>
                    <Text style={styles.studentMatricule}>{student.matricule}</Text>
                  </View>
                  {EVAL_TYPES.map(type => (
                    <TextInput
                      key={type}
                      style={styles.gradeInput}
                      value={grades[student.enrollmentId]?.[type] ?? ''}
                      onChangeText={v => updateGrade(student.enrollmentId, type, v)}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={colors.textDisabled}
                      maxLength={5}
                    />
                  ))}
                </View>
              ))
            )}
          </>
        )}

        {selectedClass && students.length === 0 && !loading && (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>Aucun élève dans cette classe</Text>
          </View>
        )}

        {!selectedClass && (
          <View style={styles.emptyBox}>
            <Ionicons name="school-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>Sélectionnez une classe pour commencer</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgSurface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn:    { padding: spacing.xs, marginRight: spacing.md },
  headerTitle:{ ...typography.h3, color: colors.textPrimary, flex: 1 },
  saveBtn: {
    backgroundColor: colors.success,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText:     { color: '#fff', fontWeight: '700', fontSize: 13 },

  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  label: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm },

  periodRow:         { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  periodBtn:         { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  periodBtnActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
  periodText:        { ...typography.small, color: colors.textMuted, fontWeight: '600' },
  periodTextActive:  { color: '#fff' },

  chip:         { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgSurface },
  chipActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText:     { ...typography.small, color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgSurface,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    borderWidth: 1, borderColor: colors.border,
  },
  thCell: {
    flex: 1, ...typography.label, color: colors.textMuted, textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: spacing.xs,
  },
  tableRowAlt: { backgroundColor: colors.bgSurface },
  studentName:      { ...typography.small, color: colors.textPrimary, fontWeight: '600' },
  studentMatricule: { fontSize: 10, color: colors.textMuted },
  gradeInput: {
    flex: 1, height: 36, marginHorizontal: 2,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, textAlign: 'center',
    color: colors.textPrimary, fontSize: 13, fontWeight: '700',
    backgroundColor: colors.bgElevated,
  },

  emptyBox: { alignItems: 'center', paddingVertical: spacing['4xl'], gap: spacing.md },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
})
