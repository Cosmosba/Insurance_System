import { useCallback, useEffect, useMemo, useState } from 'react'
import { ThemeContext } from './ThemeContext'
import { getSession } from '../services/mockAuth'
import {
  applyTheme,
  getCurrentTheme,
  setCurrentTheme,
  subscribeToThemePreferences,
} from '../services/themePreferences'

export default function ThemeProvider({ children }) {
  const [sessionEmail, setSessionEmail] = useState(() => getSession()?.email ?? null)
  const [theme, setTheme] = useState(() => applyTheme(getCurrentTheme()))

  useEffect(() => {
    const refreshTheme = () => {
      const email = getSession()?.email ?? null
      setSessionEmail(email)
      setTheme(applyTheme(getCurrentTheme(email)))
    }

    refreshTheme()
    window.addEventListener('emple:session-updated', refreshTheme)
    const unsubscribe = subscribeToThemePreferences(nextTheme => {
      setTheme(applyTheme(nextTheme))
    })
    return () => {
      window.removeEventListener('emple:session-updated', refreshTheme)
      unsubscribe()
    }
  }, [])

  const selectTheme = useCallback(nextTheme => {
    const email = getSession()?.email ?? sessionEmail
    const savedTheme = setCurrentTheme(nextTheme, email)
    setTheme(applyTheme(savedTheme))
  }, [sessionEmail])

  const value = useMemo(() => ({ theme, setTheme: selectTheme }), [theme, selectTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
