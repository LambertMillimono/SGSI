import { useSelector, useDispatch } from 'react-redux'
import type { RootState, AppDispatch } from '../store'
import { setAuth, clearAuth } from '../store/authSlice'
import { ipc } from '../utils/ipcBridge'

export function useAuth() {
  const auth = useSelector((s: RootState) => s.auth)
  const dispatch = useDispatch<AppDispatch>()

  const login = async (username: string, password: string) => {
    const result = await ipc.auth.login(username, password)
    dispatch(setAuth(result))
    return result
  }

  const logout = async () => {
    await ipc.auth.logout()
    dispatch(clearAuth())
  }

  return { ...auth, login, logout }
}
