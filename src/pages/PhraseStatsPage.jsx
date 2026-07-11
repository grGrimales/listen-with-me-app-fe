import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getPhraseLeaderboard, getMyPhraseStatsDetailed } from '../api/phrases'

const LANG_LABELS = { en: 'English', pt: 'Português' }
const LANG_FLAGS  = { en: '🇺🇸', pt: '🇧🇷' }

// Wording so this page can serve both review stats and Zen-listen stats.
export const REVIEW_LABELS = {
  title: 'Your Phrase Stats', noun: 'review', nounPlural: 'reviews',
  totalLabel: 'Total reviews', byPeriodTitle: 'Reviews by period',
  emptyTitle: 'No reviews yet',
  emptyBody: 'Head over to a phrase playlist and start reviewing — your stats will bloom here.',
  streakStartHint: 'Review a phrase today to start a streak!',
  whenTitle: 'When you review (hour of day, UTC)',
}
export const ZEN_LABELS = {
  title: 'Your Zen Listening Stats', noun: 'listen', nounPlural: 'listens',
  totalLabel: 'Total listens', byPeriodTitle: 'Listens by period',
  emptyTitle: 'No Zen listens yet',
  emptyBody: 'Start a Zen session and your listening stats will bloom here.',
  streakStartHint: 'Listen in Zen today to start a streak!',
  whenTitle: 'When you listen (hour of day, UTC)',
}

const PERIODS = [
  { key: 'day',   label: 'Today',      icon: '☀️' },
  { key: 'week',  label: 'This week',  icon: '📅' },
  { key: 'month', label: 'This month', icon: '🗓️' },
  { key: 'year',  label: 'This year',  icon: '📆' },
  { key: 'all',   label: 'All time',   icon: '♾️' },
]

const MILESTONES = [10, 50, 100, 250, 500, 1000, 2500, 5000]

export default function PhraseStatsPage({
  fetchStats = getMyPhraseStatsDetailed,
  fetchLeaderboard = getPhraseLeaderboard,
  L = REVIEW_LABELS,
} = {}) {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState(null)
  const [leaderboard, setLeaderboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activePeriod, setActivePeriod] = useState('day')
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [s, lb] = await Promise.all([
          fetchStats(token),
          fetchLeaderboard(token, 10),
        ])
        setStats(s)
        setLeaderboard(lb)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const totalReviews = stats?.counters?.all ?? 0
  const nextMilestone = useMemo(() => MILESTONES.find(m => m > totalReviews), [totalReviews])
  const prevMilestone = useMemo(() => {
    const before = MILESTONES.filter(m => m <= totalReviews)
    return before.length ? before[before.length - 1] : 0
  }, [totalReviews])
  const milestoneProgress = nextMilestone
    ? ((totalReviews - prevMilestone) / (nextMilestone - prevMilestone)) * 100
    : 100

  const dailyAverage = stats && stats.active_days > 0
    ? Math.round((totalReviews / stats.active_days) * 10) / 10
    : 0

  const maxDay30 = useMemo(() =>
    stats?.last_30_days?.reduce((m, d) => Math.max(m, d.count), 0) || 0,
    [stats]
  )

  const totalReviewsByLang = useMemo(() =>
    stats?.language_distribution?.reduce((s, l) => s + l.count, 0) || 0,
    [stats]
  )

  const peakHour = useMemo(() => {
    if (!stats?.hour_distribution) return null
    let max = 0, hour = -1
    stats.hour_distribution.forEach((c, h) => { if (c > max) { max = c; hour = h } })
    return hour === -1 ? null : { hour, count: max }
  }, [stats])

  const maxHourCount = useMemo(() =>
    stats?.hour_distribution?.reduce((m, c) => Math.max(m, c), 0) || 0,
    [stats]
  )

  const currentRanking = leaderboard?.[activePeriod] || []

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="bg-white border-b border-stone-200 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl">🎧</span>
          <span className="text-emerald-700 text-lg font-bold tracking-tight">Listen With Me</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link to="/phrases" className="text-stone-500 hover:text-stone-800 text-sm font-semibold transition">
            ← Back to Phrases
          </Link>
          <div className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 transition rounded-xl pl-3 pr-1 py-1">
            <span className="text-sm text-stone-600 font-medium leading-none">{user?.fullName?.split(' ')[0]}</span>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="w-6 h-6 rounded-lg bg-white hover:bg-red-50 hover:text-red-500 text-stone-400 flex items-center justify-center transition shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-stone-800 tracking-tight">📊 {L.title}</h2>
          <p className="text-sm text-stone-400 mt-1">A snapshot of your learning journey</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-4"></div>
            <p>Crunching numbers...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center">{error}</div>
        ) : !stats ? null : totalReviews === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
            <span className="text-6xl mb-4 block">🌱</span>
            <h3 className="text-xl font-bold text-stone-800 mb-2">{L.emptyTitle}</h3>
            <p className="text-stone-500 max-w-md mx-auto mb-4">
              {L.emptyBody}
            </p>
            <Link to="/phrases" className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl transition">
              Open playlists
            </Link>
          </div>
        ) : (
          <>
            {/* Hero: total + streaks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="md:col-span-1 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-3xl p-6 shadow-lg shadow-emerald-900/10">
                <p className="text-xs opacity-80 font-semibold uppercase tracking-wider mb-2">{L.totalLabel}</p>
                <p className="text-5xl font-bold leading-none">{totalReviews.toLocaleString()}</p>
                <p className="text-sm opacity-80 mt-3">
                  <span className="font-bold">{stats.unique_phrases}</span> unique phrases · <span className="font-bold">{stats.active_days}</span> active days
                </p>
                {nextMilestone && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px] opacity-80 mb-1">
                      <span>Next milestone</span>
                      <span className="font-bold">{nextMilestone.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white transition-all duration-500"
                        style={{ width: `${milestoneProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-3xl border border-stone-200 p-6 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-stone-400 font-semibold uppercase tracking-wider mb-2">🔥 Current streak</p>
                  <p className="text-4xl font-bold text-stone-800 leading-none">
                    {stats.streak.current}
                    <span className="text-lg text-stone-400 ml-1">day{stats.streak.current === 1 ? '' : 's'}</span>
                  </p>
                </div>
                <p className="text-xs text-stone-400 mt-3">
                  {stats.streak.current === 0
                    ? L.streakStartHint
                    : 'Keep the habit daily to keep it alive.'}
                </p>
              </div>

              <div className="bg-white rounded-3xl border border-stone-200 p-6 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-stone-400 font-semibold uppercase tracking-wider mb-2">🏆 Longest streak</p>
                  <p className="text-4xl font-bold text-stone-800 leading-none">
                    {stats.streak.longest}
                    <span className="text-lg text-stone-400 ml-1">day{stats.streak.longest === 1 ? '' : 's'}</span>
                  </p>
                </div>
                <p className="text-xs text-stone-400 mt-3">
                  {stats.streak.longest === stats.streak.current && stats.streak.current > 0
                    ? "You're on your best streak — go you! 🎉"
                    : 'Your personal best so far.'}
                </p>
              </div>
            </div>

            {/* Period counters */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-3">{L.byPeriodTitle}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {PERIODS.map(p => (
                  <div key={p.key} className="bg-white rounded-2xl border border-stone-200 p-4">
                    <p className="text-xs text-stone-400 font-semibold mb-1">{p.icon} {p.label}</p>
                    <p className="text-2xl font-bold text-stone-800">{stats.counters?.[p.key] ?? 0}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Fun facts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <div className="bg-white rounded-2xl border border-stone-200 p-5">
                <p className="text-xs text-stone-400 font-semibold uppercase tracking-wider mb-1">📈 Daily average</p>
                <p className="text-2xl font-bold text-stone-800">{dailyAverage}</p>
                <p className="text-[11px] text-stone-400 mt-0.5">per active day</p>
              </div>
              <div className="bg-white rounded-2xl border border-stone-200 p-5">
                <p className="text-xs text-stone-400 font-semibold uppercase tracking-wider mb-1">🌟 Best day</p>
                {stats.best_day ? (
                  <>
                    <p className="text-2xl font-bold text-stone-800">{stats.best_day.count} {L.nounPlural}</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">{formatDate(stats.best_day.date)}</p>
                  </>
                ) : (
                  <p className="text-sm text-stone-400 italic">No data yet</p>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-stone-200 p-5">
                <p className="text-xs text-stone-400 font-semibold uppercase tracking-wider mb-1">🕓 Peak hour</p>
                {peakHour ? (
                  <>
                    <p className="text-2xl font-bold text-stone-800">{formatHour(peakHour.hour)}</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">{peakHour.count} {L.nounPlural} at this hour</p>
                  </>
                ) : (
                  <p className="text-sm text-stone-400 italic">No data yet</p>
                )}
              </div>
            </div>

            {/* Last 30 days chart */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
              <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4">📊 Last 30 days</h3>
              <div className="flex items-end gap-1 h-32">
                {stats.last_30_days.map(d => {
                  const pct = maxDay30 > 0 ? (d.count / maxDay30) * 100 : 0
                  return (
                    <div
                      key={d.date}
                      className="flex-1 flex flex-col justify-end group relative"
                      title={`${formatDate(d.date)} — ${d.count} ${d.count === 1 ? L.noun : L.nounPlural}`}
                    >
                      <div
                        className={`w-full rounded-t transition-all ${d.count === 0 ? 'bg-stone-100' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                        style={{ height: d.count === 0 ? '4px' : `${Math.max(pct, 8)}%` }}
                      />
                      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-stone-800 text-white text-[10px] font-bold rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                        {d.count}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] text-stone-400 font-semibold uppercase tracking-wider mt-2">
                <span>{formatDateShort(stats.last_30_days[0]?.date)}</span>
                <span>Today</span>
              </div>
            </div>

            {/* Two-column: top playlists + language mix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-2xl border border-stone-200 p-6">
                <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4">🎯 Top playlists</h3>
                {stats.top_playlists.length === 0 ? (
                  <p className="text-sm text-stone-400 italic">No data yet</p>
                ) : (
                  <ul className="space-y-3">
                    {stats.top_playlists.map((p, i) => {
                      const maxCount = stats.top_playlists[0].count
                      const pct = (p.count / maxCount) * 100
                      return (
                        <li key={p.id}>
                          <Link to={`/phrases/${p.id}`} className="block group">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold text-stone-700 truncate group-hover:text-emerald-700 transition">
                                <span className="text-stone-400 mr-2">#{i + 1}</span>
                                {LANG_FLAGS[p.language] || '🌐'} {p.name}
                              </span>
                              <span className="text-xs font-bold text-stone-500 flex-shrink-0 ml-2">{p.count}</span>
                            </div>
                            <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 p-6">
                <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4">🌍 Language mix</h3>
                {stats.language_distribution.length === 0 ? (
                  <p className="text-sm text-stone-400 italic">No data yet</p>
                ) : (
                  <ul className="space-y-4">
                    {stats.language_distribution.map(l => {
                      const pct = totalReviewsByLang > 0 ? (l.count / totalReviewsByLang) * 100 : 0
                      return (
                        <li key={l.language}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-stone-700">
                              {LANG_FLAGS[l.language] || '🌐'} {LANG_LABELS[l.language] || l.language}
                            </span>
                            <span className="text-xs font-bold text-stone-500">{l.count} · {Math.round(pct)}%</span>
                          </div>
                          <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Hour of day */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6 mb-6">
              <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4">⏰ {L.whenTitle}</h3>
              <div className="flex items-end gap-1 h-24">
                {stats.hour_distribution.map((c, h) => {
                  const pct = maxHourCount > 0 ? (c / maxHourCount) * 100 : 0
                  return (
                    <div key={h} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="w-full flex flex-col justify-end h-full">
                        <div
                          className={`w-full rounded-t transition-all ${c === 0 ? 'bg-stone-100' : 'bg-emerald-400 hover:bg-emerald-600'}`}
                          style={{ height: c === 0 ? '3px' : `${Math.max(pct, 8)}%` }}
                          title={`${h}:00 — ${c} ${L.nounPlural}`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="grid grid-cols-6 text-[10px] text-stone-400 font-semibold mt-2">
                <span>0h</span>
                <span className="text-center">4h</span>
                <span className="text-center">8h</span>
                <span className="text-center">12h</span>
                <span className="text-center">16h</span>
                <span className="text-right">20h</span>
              </div>
            </div>

            {/* Journey start */}
            {stats.first_review_at && (
              <div className="bg-stone-800 text-white rounded-2xl p-6 mb-6 flex items-center gap-4">
                <span className="text-4xl">🚀</span>
                <div>
                  <p className="text-xs text-emerald-300 font-semibold uppercase tracking-wider mb-1">Journey started</p>
                  <p className="text-lg font-bold">{formatDate(stats.first_review_at.split('T')[0])}</p>
                  <p className="text-xs text-stone-400 mt-0.5">You've been at this for {daysSince(stats.first_review_at)} days</p>
                </div>
              </div>
            )}

            {/* Leaderboard collapsible */}
            <button
              onClick={() => setShowLeaderboard(v => !v)}
              className="w-full flex items-center justify-between px-6 py-4 bg-white border border-stone-200 rounded-2xl hover:bg-stone-50 transition mb-3"
            >
              <span className="font-bold text-stone-700 text-sm">
                🥇 Community leaderboard
              </span>
              <svg className={`w-4 h-4 text-stone-400 transition-transform ${showLeaderboard ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showLeaderboard && (
              <div className="bg-white rounded-2xl border border-stone-200 p-6">
                <div className="mb-4 flex flex-wrap gap-2">
                  {PERIODS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => setActivePeriod(p.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${activePeriod === p.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-stone-500 border-stone-200 hover:border-emerald-400 hover:text-emerald-700'}`}
                    >
                      {p.icon} {p.label}
                    </button>
                  ))}
                </div>
                {currentRanking.length === 0 ? (
                  <p className="text-sm text-stone-400 italic text-center py-6">No {L.nounPlural} recorded for this period yet.</p>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {currentRanking.map((row, i) => {
                      const isMe = row.user_id === user?.id
                      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`
                      return (
                        <li key={row.user_id} className={`py-3 flex items-center gap-4 transition ${isMe ? 'bg-emerald-50/50 -mx-6 px-6 rounded' : ''}`}>
                          <span className="w-10 text-center font-bold text-stone-500">{medal}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`font-bold truncate ${isMe ? 'text-emerald-700' : 'text-stone-800'}`}>
                              {row.full_name}
                              {isMe && <span className="ml-2 text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">You</span>}
                            </p>
                          </div>
                          <span className="text-lg font-bold text-stone-800">{row.count}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const date = new Date(Date.UTC(+y, +m - 1, +d))
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateShort(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const date = new Date(Date.UTC(+y, +m - 1, +d))
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function formatHour(h) {
  return `${String(h).padStart(2, '0')}:00`
}

function daysSince(iso) {
  const then = new Date(iso).getTime()
  const now = Date.now()
  return Math.max(1, Math.floor((now - then) / (1000 * 60 * 60 * 24)))
}
