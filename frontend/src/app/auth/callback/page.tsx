'use client'

import { Suspense } from 'react'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Code2, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useUserStore } from '@/lib/store'

const appleEase = [0.25, 0.1, 0.25, 1] as const

function StatusCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-dv-bg flex items-center justify-center text-white selection:bg-dv-accent/30">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-dv-accent/[0.06] to-transparent rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[20%] w-[300px] h-[300px] bg-dv-purple/[0.04] rounded-full blur-[80px]" />
      </div>

      <motion.div
        className="relative z-10 text-center"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: appleEase }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-dv-accent to-dv-indigo flex items-center justify-center">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-[22px] font-bold tracking-[-0.02em] bg-clip-text text-transparent bg-gradient-to-r from-dv-accent to-dv-purple">
            DocuVerse
          </span>
        </div>

        {/* Glass card */}
        <div className="rounded-2xl bg-[var(--glass-4)] backdrop-blur-2xl border border-dv-border p-10 min-w-[320px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.5)]">
          {children}
        </div>
      </motion.div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <StatusCard>
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-dv-accent animate-spin" />
        <p className="text-[15px] text-dv-text/50">Loading...</p>
      </div>
    </StatusCard>
  )
}

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const { setToken, setUser } = useUserStore()

  const handleCallback = useCallback(async () => {
    const token = searchParams.get('token')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      setStatus('error')
      setError(errorParam)
      return
    }

    if (!token) {
      setStatus('error')
      setError('No authentication token received')
      return
    }

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token)
      }
      
      setToken(token)
      await new Promise(resolve => setTimeout(resolve, 100))

      const api = await import('@/lib/api')
      const user = await api.auth.getMe()
      
      setUser({
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatar_url,
      })

      setStatus('success')
      setTimeout(() => {
        router.replace('/dashboard')
      }, 1500)
    } catch (err) {
      console.error('Auth callback error:', err)
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to complete authentication')
    }
  }, [searchParams, router, setToken, setUser])

  useEffect(() => {
    handleCallback()
  }, [handleCallback])

  if (status === 'loading') {
    return (
      <StatusCard>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-dv-accent/10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-dv-accent animate-spin" />
          </div>
          <p className="text-[15px] text-dv-text/50">Completing authentication...</p>
          <div className="w-32 h-[3px] bg-[var(--glass-6)] rounded-full overflow-hidden mt-1">
            <motion.div
              className="h-full bg-dv-accent rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: '80%' }}
              transition={{ duration: 3, ease: [0.42, 0, 0.58, 1] }}
            />
          </div>
        </div>
      </StatusCard>
    )
  }

  if (status === 'success') {
    return (
      <StatusCard>
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="w-14 h-14 rounded-full bg-dv-success/10 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
          >
            <CheckCircle2 className="w-7 h-7 text-dv-success" />
          </motion.div>
          <div>
            <p className="text-[17px] font-bold tracking-[-0.01em] mb-1">
              Welcome to DocuVerse!
            </p>
            <p className="text-[13px] text-dv-text/35">Redirecting to dashboard...</p>
          </div>
        </div>
      </StatusCard>
    )
  }

  return (
    <StatusCard>
      <div className="flex flex-col items-center gap-4">
        <motion.div
          className="w-14 h-14 rounded-full bg-dv-error/10 flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
        >
          <XCircle className="w-7 h-7 text-dv-error" />
        </motion.div>
        <div>
          <p className="text-[17px] font-bold tracking-[-0.01em] mb-1">
            Authentication Failed
          </p>
          <p className="text-[13px] text-dv-text/35">{error}</p>
        </div>
        <button
          onClick={() => router.replace('/auth/signin')}
          className="mt-2 text-[13px] font-medium bg-[var(--glass-8)] backdrop-blur-xl border border-dv-border text-white px-5 py-2 rounded-full hover:bg-white/[0.14] hover:border-white/[0.18] active:scale-[0.97] transition-all shadow-[var(--inset)]"
        >
          Try Again
        </button>
      </div>
    </StatusCard>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthCallbackContent />
    </Suspense>
  )
}
