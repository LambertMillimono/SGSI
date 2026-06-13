import { createSlice, PayloadAction } from '@reduxjs/toolkit'

type UserRole = 'SUPER_ADMIN' | 'DIRECTOR' | 'SECRETARY' | 'ACCOUNTANT' | 'TEACHER'

interface AuthState {
  token: string | null
  userId: string | null
  role: UserRole | null
  username: string | null
  firstName: string | null
  lastName: string | null
  isAuthenticated: boolean
  mustChangePassword: boolean
}

const initialState: AuthState = {
  token: null, userId: null, role: null, username: null,
  firstName: null, lastName: null,
  isAuthenticated: false, mustChangePassword: false,
}

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<{
      token: string
      user: { id: string; username: string; role: string; firstName: string; lastName: string }
      mustChangePassword?: boolean
    }>) => {
      state.token = action.payload.token
      state.userId = action.payload.user.id
      state.role = action.payload.user.role as UserRole
      state.username = action.payload.user.username
      state.firstName = action.payload.user.firstName
      state.lastName = action.payload.user.lastName
      state.isAuthenticated = true
      state.mustChangePassword = action.payload.mustChangePassword ?? false
    },
    clearAuth: () => initialState,
  },
})

export const { setAuth, clearAuth } = authSlice.actions
export default authSlice.reducer
