'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Play,
  Search,
  Clock,
  FileCode,
  Trash2,
  Loader2,
  Sparkles,
  ChevronRight,
  Settings,
  FolderGit2,
} from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { repositories, walkthroughs, Repository, WalkthroughScript } from '@/lib/api'
import toast from 'react-hot-toast'

const ease = [0.25, 0.1, 0.25, 1] as const

interface WalkthroughEntry extends WalkthroughScript {
  repoId: string
  repoName: string
}

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${Math.round(seconds)} sec`
  const mins = seconds / 60
  return `${parseFloat(mins.toFixed(1))} min`
}

export default function WalkthroughsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'developer' | 'manager'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'duration'>('recent')
  const [entries, setEntries] = useState<WalkthroughEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [navigatingId, setNavigatingId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    async function loadAll() {
      setIsLoading(true)
      try {
        const repos = await repositories.list()
        const all: WalkthroughEntry[] = []

        const results = await Promise.allSettled(
          repos
            .filter((repo) => repo.is_indexed)
            .map(async (repo) => {
              const repoWalkthroughs = await walkthroughs.getForRepo(repo.id)
              return repoWalkthroughs.map((wt) => ({
                ...wt,
                repoId: repo.id,
                repoName: repo.name,
              }))
            })
        )

        for (const result of results) {
          if (result.status === 'fulfilled') {
            all.push(...result.value)
          }
        }

        setEntries(all)
      } catch {
        toast.error('Failed to load walkthroughs')
      } finally {
        setIsLoading(false)
      }
    }
    loadAll()
  }, [])

  const filteredEntries = entries
    .filter((wt) => {
      if (filterMode !== 'all' && wt.view_mode !== filterMode) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          wt.title.toLowerCase().includes(q) ||
          wt.file_path.toLowerCase().includes(q) ||
          wt.repoName.toLowerCase().includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'duration') return b.total_duration - a.total_duration
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    })

  const handleDelete = async (id: string) => {
    try {
      await walkthroughs.delete(id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
      toast.success('Walkthrough deleted')
    } catch {
      toast.error('Failed to delete walkthrough')
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-dv-bg flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-dv-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dv-bg flex text-dv-text selection:bg-dv-accent/30">
      <Sidebar />

      <main className="flex-1 overflow-y-auto relative">
        {/* Ambient */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] left-[15%] w-[600px] h-[400px] bg-dv-purple/[0.03] rounded-full blur-[140px]" />
          <div className="absolute bottom-[-10%] right-[20%] w-[500px] h-[400px] bg-dv-accent/[0.025] rounded-full blur-[120px]" />
        </div>

        {/* Frosted top bar */}
        <div className="sticky top-0 z-20 bg-[var(--bar-bg)] backdrop-blur-2xl backdrop-saturate-[1.8] border-b border-dv-border">
          <div className="flex items-center justify-between px-8 h-12 max-w-[1100px] mx-auto">
            <h1 className="text-[15px] font-semibold tracking-[-0.01em]">Walkthroughs</h1>
            <Link
              href="/dashboard"
              className="text-[13px] font-medium text-dv-text/40 hover:text-dv-text/70 transition-colors flex items-center gap-1.5"
            >
              Dashboard <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        <div className="relative z-[1] px-8 py-10 max-w-[1100px] mx-auto">

          {/* Header */}
          <motion.div
            className="mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-[-0.035em] leading-[1.1] mb-3">
              Your{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-dv-purple via-dv-indigo to-dv-accent">
                Walkthroughs
              </span>
            </h2>
            <p className="text-[15px] text-dv-text/30 leading-relaxed max-w-lg">
              {entries.length === 0 && !isLoading
                ? 'Generate AI-powered code walkthroughs from your indexed repositories.'
                : `${entries.length} walkthrough${entries.length === 1 ? '' : 's'} generated across your repositories.`}
            </p>
          </motion.div>

          {/* Filters bar */}
          <motion.div
            className="flex items-center gap-3 mb-8 flex-wrap"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5, ease }}
          >
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dv-text/20" />
              <input
                type="text"
                placeholder="Search walkthroughs…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--glass-4)] border border-dv-border rounded-xl px-4 py-2.5 pl-10 text-[13px] text-dv-text placeholder:text-dv-text/20 focus:outline-none focus:ring-1 focus:ring-dv-accent/25 focus:border-dv-accent/30 transition-all"
              />
            </div>

            {/* Segmented control */}
            <div className="flex items-center bg-[var(--glass-4)] border border-dv-border rounded-xl p-0.5">
              {(['all', 'developer', 'manager'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`px-4 py-1.5 rounded-[10px] text-[12px] font-semibold capitalize transition-all ${
                    filterMode === mode
                      ? 'bg-[var(--glass-10)] text-dv-text shadow-[var(--inset)]'
                      : 'text-dv-text/30 hover:text-dv-text/50'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'duration')}
              className="bg-[var(--glass-4)] border border-dv-border rounded-xl py-2.5 px-3 text-[12px] font-medium text-dv-text/50 focus:outline-none focus:ring-1 focus:ring-dv-accent/25 appearance-none cursor-pointer hover:bg-[var(--glass-6)] transition-all"
            >
              <option value="recent">Recent</option>
              <option value="duration">Longest</option>
            </select>
          </motion.div>

          {/* Section header */}
          <div className="mb-4">
            <span className="text-[13px] font-semibold text-dv-text/25 uppercase tracking-[0.06em]">
              {filteredEntries.length} walkthrough{filteredEntries.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Content */}
          {isLoading ? (
            <motion.div
              className="rounded-2xl bg-[var(--glass-3)] backdrop-blur-2xl border border-dv-border flex items-center justify-center py-24 shadow-[var(--inset)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="text-center">
                <Loader2 className="w-6 h-6 text-dv-purple animate-spin mx-auto mb-3" />
                <span className="text-[14px] text-dv-text/25">Loading walkthroughs…</span>
              </div>
            </motion.div>
          ) : filteredEntries.length > 0 ? (
            <div className="rounded-2xl bg-[var(--glass-4)] backdrop-blur-2xl border border-dv-border overflow-hidden shadow-[var(--inset)]">
              {filteredEntries.map((wt, i) => (
                <motion.div
                  key={wt.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.04, ease }}
                  className={`group flex items-center gap-4 px-5 py-4 hover:bg-[var(--glass-3)] transition-all ${
                    i < filteredEntries.length - 1 ? 'border-b border-dv-border-subtle' : ''
                  }`}
                >
                  {/* Play icon */}
                  <button
                    onClick={() => {
                      setNavigatingId(wt.id)
                      router.push(`/repository/${wt.repoId}/walkthrough?file=${encodeURIComponent(wt.file_path)}`)
                    }}
                    className="w-11 h-11 rounded-xl bg-dv-purple/10 border border-dv-purple/10 flex items-center justify-center flex-shrink-0 group-hover:bg-dv-purple/20 group-hover:border-dv-purple/20 transition-all"
                  >
                    {navigatingId === wt.id ? (
                      <Loader2 className="w-4 h-4 text-dv-purple animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 text-dv-purple ml-0.5" />
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-0.5">
                      <button
                        onClick={() => {
                          setNavigatingId(wt.id)
                          router.push(`/repository/${wt.repoId}/walkthrough?file=${encodeURIComponent(wt.file_path)}`)
                        }}
                        className="text-[14px] font-semibold tracking-[-0.01em] truncate hover:text-white transition-colors text-left"
                      >
                        {wt.title}
                      </button>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
                          wt.view_mode === 'developer'
                            ? 'bg-dv-accent/10 text-dv-accent'
                            : 'bg-dv-purple/10 text-dv-purple'
                        }`}
                      >
                        {wt.view_mode}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-dv-text/25">
                      <span className="flex items-center gap-1">
                        <FileCode className="w-3 h-3" />
                        {wt.file_path}
                      </span>
                      <span className="text-dv-text/10">·</span>
                      <span className="flex items-center gap-1">
                        <FolderGit2 className="w-3 h-3" />
                        {wt.repoName}
                      </span>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-5 text-[12px] text-dv-text/25 flex-shrink-0">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {formatDuration(wt.total_duration)}
                    </span>
                    <span className="hidden sm:block">{wt.segments.length} segments</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={() => {
                        setNavigatingId(wt.id)
                        router.push(`/repository/${wt.repoId}/walkthrough?file=${encodeURIComponent(wt.file_path)}`)
                      }}
                      className="text-[12px] font-semibold px-3.5 py-1.5 rounded-full bg-dv-purple/10 text-dv-purple hover:bg-dv-purple/20 transition-colors flex items-center gap-1.5"
                    >
                      {navigatingId === wt.id ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Loading…</>
                      ) : (
                        'Play'
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(wt.id)}
                      className="p-2 rounded-full hover:bg-dv-error/10 hover:text-dv-error transition-colors text-dv-text/15"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <EmptyState hasSearch={searchQuery.length > 0 || filterMode !== 'all'} />
          )}
        </div>
      </main>
    </div>
  )
}

/* ── Empty State ── */
function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  if (hasSearch) {
    return (
      <div className="rounded-2xl bg-[var(--glass-3)] backdrop-blur-2xl border border-dv-border text-center py-16 shadow-[var(--inset)]">
        <Search className="w-5 h-5 text-dv-text/15 mx-auto mb-3" />
        <p className="text-[14px] text-dv-text/30">No walkthroughs match your filters.</p>
      </div>
    )
  }

  return (
    <motion.div
      className="rounded-2xl bg-[var(--glass-3)] backdrop-blur-2xl border border-dv-border text-center py-24 px-8 shadow-[var(--inset)] relative overflow-hidden"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease }}
    >
      {/* Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-dv-purple/[0.04] rounded-full blur-[80px] pointer-events-none" />

      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-dv-purple/15 to-dv-indigo/15 border border-dv-purple/10 flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(var(--dv-purple),0.08)]">
          <Sparkles className="w-7 h-7 text-dv-purple" />
        </div>
        <h3 className="text-[22px] font-bold tracking-[-0.02em] mb-2">No walkthroughs yet</h3>
        <p className="text-[14px] text-dv-text/30 mb-8 max-w-sm mx-auto leading-relaxed">
          Open an indexed repository and generate your first AI-powered code walkthrough with voice narration.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2.5 bg-[var(--btn-solid-bg)] text-[var(--btn-solid-text)] font-semibold text-[14px] px-7 py-3 rounded-full hover:bg-[var(--btn-solid-hover)] active:scale-[0.97] transition-all shadow-[0_2px_20px_rgba(255,255,255,0.1)]"
        >
          <Play className="w-4 h-4" />
          Go to Dashboard
        </Link>
      </div>
    </motion.div>
  )
}
