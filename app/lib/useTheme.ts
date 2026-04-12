import { useState, useEffect } from 'react'

export function useTheme() {
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('filmo_theme') || 'dark'
    setThemeState(saved as 'dark' | 'light')
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  const setTheme = (t: 'dark' | 'light') => {
    setThemeState(t)
    localStorage.setItem('filmo_theme', t)
    document.documentElement.setAttribute('data-theme', t)
  }

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return { theme, setTheme, toggle }
}
