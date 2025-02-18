import type { AppProps } from 'next/app'
import React, {
  createContext,
  useEffect,
  useState,
  useRef,
  useCallback
} from 'react'
import '../styles/globals.css'            // <-- ваш основной глобальный файл
import '../styles/dashstyles.css'         // <-- новые стили дашборда, импортируем глобально

import { useRouter } from 'next/router'

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000

interface AuthContextValue {
  isUnlocked: boolean
  lockWallet: () => void
  unlockWallet: () => void
}

export const AuthContext = createContext<AuthContextValue>({
  isUnlocked: false,
  lockWallet: () => {},
  unlockWallet: () => {},
})

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const [isUnlocked, setIsUnlocked] = useState(false)
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null)

  const lockWallet = useCallback(() => {
    setIsUnlocked(false)
  }, [])

  const unlockWallet = useCallback(() => {
    setIsUnlocked(true)
  }, [])

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current)
    }
    inactivityTimer.current = setTimeout(() => {
      lockWallet()
      router.push('/wallet/select')
    }, INACTIVITY_TIMEOUT_MS)
  }, [lockWallet, router])

  useEffect(() => {
    function handleUserActivity() {
      if (isUnlocked) {
        resetInactivityTimer()
      }
    }
    window.addEventListener('mousemove', handleUserActivity)
    window.addEventListener('keydown', handleUserActivity)

    if (typeof window !== 'undefined' && (window as any).electronAPI?.onWindowBlur) {
      ;(window as any).electronAPI.onWindowBlur(() => {
        lockWallet()
        router.push('/wallet/select')
      })
    }

    return () => {
      window.removeEventListener('mousemove', handleUserActivity)
      window.removeEventListener('keydown', handleUserActivity)
    }
  }, [isUnlocked, resetInactivityTimer, lockWallet, router])

  useEffect(() => {
    if (isUnlocked) {
      resetInactivityTimer()
    } else {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current)
      }
    }
  }, [isUnlocked, resetInactivityTimer])

  const authValue: AuthContextValue = {
    isUnlocked,
    lockWallet,
    unlockWallet,
  }

  return (
    <AuthContext.Provider value={authValue}>
      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          margin: '0 auto',
        }}
      >
        <Component {...pageProps} />
      </div>
    </AuthContext.Provider>
  )
}
