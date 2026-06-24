import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface UiState {
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
}

// Apply dark mode immediately so no flash of light theme on startup
document.documentElement.classList.add('dark')

const initialState: UiState = {
  sidebarCollapsed: false,
  theme: 'dark',
}

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => { state.sidebarCollapsed = !state.sidebarCollapsed },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload
      document.documentElement.classList.toggle('dark', action.payload === 'dark')
    },
  },
})

export const { toggleSidebar, setTheme } = uiSlice.actions
export default uiSlice.reducer
