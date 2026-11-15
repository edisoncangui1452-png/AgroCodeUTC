import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Globe2, Moon, Sun } from 'lucide-react'

const PreferencesContext = createContext(null)
const LANGUAGE_KEY = 'agrocode-language'
const THEME_KEY = 'agrocode-theme'

export function resolveInitialLanguage(saved) {
  return saved === 'en' ? 'en' : 'es'
}

export function resolveInitialTheme(saved, prefersDark) {
  if (saved === 'light' || saved === 'dark') return saved
  return prefersDark ? 'dark' : 'light'
}

export function nextTheme(current) {
  return current === 'dark' ? 'light' : 'dark'
}

export function persistLanguage(storage, language) {
  storage.setItem(LANGUAGE_KEY, language)
}

export function persistTheme(storage, theme) {
  storage.setItem(THEME_KEY, theme)
}

export function normalizeLanguage(language) {
  return language === 'en' ? 'en' : 'es'
}

function initialTheme() {
  const theme = resolveInitialTheme(localStorage.getItem(THEME_KEY), window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  return theme
}

export function PreferencesProvider({ children }) {
  const [language, setLanguage] = useState(() => resolveInitialLanguage(localStorage.getItem(LANGUAGE_KEY)))
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    persistLanguage(localStorage, language)
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    persistTheme(localStorage, theme)
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper-rgb').trim().split(/\s+/)
    if (paper.length === 3) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${paper.join(' ')})`)
  }, [theme])

  const value = useMemo(() => ({
    language,
    theme,
    setLanguage: next => setLanguage(normalizeLanguage(next)),
    toggleTheme: () => setTheme(nextTheme),
  }), [language, theme])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  return useContext(PreferencesContext)
}

export function PreferenceControls() {
  const { language, setLanguage, theme, toggleTheme } = usePreferences()
  const english = language === 'en'
  return <div className="header-preferences no-print" aria-label={english ? 'Display settings' : 'Ajustes de apariencia'}>
    <span className="preferences-caption">{english ? 'Appearance settings' : 'Ajustes de apariencia'}</span>
    <div className="preference-actions" role="group" aria-label={english ? 'Display preferences' : 'Preferencias de visualización'}>
      <button type="button" className="preference-button" aria-label={english ? 'Change language to Spanish' : 'Cambiar idioma a inglés'} onClick={() => setLanguage(english ? 'es' : 'en')}>
        <Globe2 size={18} aria-hidden="true" /><span className="preference-button-label">{english ? 'EN · Español' : 'ES · English'}</span>
      </button>
      <button type="button" className="preference-button preference-theme" aria-label={english ? (theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme') : (theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro')} onClick={toggleTheme}>
        {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        <span className="preference-button-label">{english ? (theme === 'dark' ? 'Light' : 'Dark') : (theme === 'dark' ? 'Claro' : 'Oscuro')}</span>
      </button>
    </div>
    {english && <span className="preference-fallback" role="note">Some sections are still shown in Spanish because a translation is not available.</span>}
  </div>
}

export function translated(language, spanish, english) {
  return language === 'en' ? (english || `${spanish} [ES]`) : spanish
}
