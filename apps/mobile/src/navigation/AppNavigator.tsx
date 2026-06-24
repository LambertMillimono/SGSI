/**
 * Root navigator — auth-based + role-based routing (no external nav library needed)
 */

import React, { useEffect, useState } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { useAuthStore } from '../store/auth.store'
import { ConnectScreen } from '../screens/ConnectScreen'
import { ParentDashboard } from '../screens/parent/ParentDashboard'
import { TeacherDashboard } from '../screens/teacher/TeacherDashboard'
import { GradeEntryScreen } from '../screens/teacher/GradeEntryScreen'
import { AbsenceScreen } from '../screens/teacher/AbsenceScreen'
import { colors } from '../utils/theme'

type TeacherScreen = 'Dashboard' | 'GradeEntry' | 'Absences' | 'Schedule' | 'Classes'

export function AppNavigator() {
  const { isLoading, isAuthenticated, initialize, role, studentId } = useAuthStore()
  const [teacherScreen, setTeacherScreen] = useState<TeacherScreen>('Dashboard')

  useEffect(() => { initialize() }, [])

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!isAuthenticated) return <ConnectScreen />

  // Teacher flow with internal screen stack
  const isTeacher = role === 'TEACHER'
  if (isTeacher) {
    if (teacherScreen === 'GradeEntry') {
      return <GradeEntryScreen onBack={() => setTeacherScreen('Dashboard')} />
    }
    if (teacherScreen === 'Absences') {
      return <AbsenceScreen onBack={() => setTeacherScreen('Dashboard')} />
    }
    return (
      <TeacherDashboard
        onNavigate={(screen) => setTeacherScreen(screen as TeacherScreen)}
      />
    )
  }

  // Parent / student / admin flow
  return <ParentDashboard studentId={studentId ?? ''} />
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
