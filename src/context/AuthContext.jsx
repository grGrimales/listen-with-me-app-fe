import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })

  const targetLanguage = user?.targetLanguage || 'en'

  function saveAuth(token, user) {
    const userWithLang = { ...user, targetLanguage: user.targetLanguage || 'en' }
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userWithLang))
    setToken(token)
    setUser(userWithLang)
  }

  function setTargetLanguage(lang) {
    const updated = { ...user, targetLanguage: lang }
    localStorage.setItem('user', JSON.stringify(updated))
    setUser(updated)
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  useEffect(() => {
    window.addEventListener('api:unauthorized', logout)
    return () => window.removeEventListener('api:unauthorized', logout)
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, saveAuth, logout, isAuthenticated: !!token, targetLanguage, setTargetLanguage }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
