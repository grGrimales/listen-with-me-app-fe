import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getPhrasePlaylist, getPlaylistEvaluationStats, evaluatePhrase, getPhraseEvaluationHistory,
} from '../api/phrases'
import GroupMultiSelect from '../components/GroupMultiSelect'

const LANG_LABELS = { en: 'English', pt: 'Português' }
const LANG_FLAGS  = { en: '🇺🇸', pt: '🇧🇷' }

const SORT_OPTIONS = [
  { value: 'playlist',    label: '📋 Playlist order' },
  { value: 'random',      label: '🎲 Random' },
  { value: 'least_tried', label: '🌱 Least practiced' },
  { value: 'most_failed', label: '🔥 Most failed' },
  { value: 'never_right', label: '❌ Never correct' },
]

const SESSION_SIZES = [5, 10, 20, 30, 0] // 0 = All

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Mirrors the server-side comparison so the inline diff highlights the same way
// the backend scored the answer.
function normalizeAnswer(s) {
  return (s || '')
    .toLowerCase()
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/[.,!?;:¡¿"()…]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

const EMPTY_STAT = { correct_count: 0, failed_count: 0, total_attempts: 0 }

export default function PhraseEvaluationPage() {
  const { id } = useParams()
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [playlist, setPlaylist] = useState(null)
  const [statsById, setStatsById] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [groupFilterIds, setGroupFilterIds] = useState([])
  const [sortBy, setSortBy] = useState('playlist')
  const [sessionSize, setSessionSize] = useState(() => {
    try {
      const v = localStorage.getItem('phraseEval.sessionSize')
      return v ? Number(v) : 0
    } catch { return 0 }
  })

  const [deck, setDeck] = useState([])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState(null) // {is_correct, expected}
  const [checking, setChecking] = useState(false)
  const [session, setSession] = useState({ correct: 0, failed: 0 })
  const [missed, setMissed] = useState([])      // phrases failed this session
  const [finished, setFinished] = useState(false)

  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const inputRef = useRef(null)

  const groupFilterKey = groupFilterIds.join(',')

  useEffect(() => {
    setLoading(true)
    setError('')
    setGroupFilterIds([])
    Promise.all([
      getPhrasePlaylist(id, token),
      getPlaylistEvaluationStats(id, token).catch(() => []),
    ])
      .then(([pl, stats]) => {
        setPlaylist(pl)
        const map = {}
        stats.forEach(s => { map[s.phrase_id] = s })
        setStatsById(map)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, token])

  useEffect(() => {
    try { localStorage.setItem('phraseEval.sessionSize', String(sessionSize)) } catch { /* noop */ }
  }, [sessionSize])

  const groupOptions = useMemo(
    () => (playlist?.groups || []).map(g => ({ id: g.id, name: g.name, count: g.phrases.length })),
    [playlist?.groups]
  )

  // Build the deck from the selected groups, ordered by the chosen strategy.
  // Only phrases that actually have a Spanish translation can be prompted.
  useEffect(() => {
    if (!playlist) return
    const groups = groupFilterIds.length > 0
      ? playlist.groups.filter(g => groupFilterIds.includes(g.id))
      : playlist.groups
    let flat = groups
      .flatMap(g => g.phrases.map(p => ({ ...p, groupName: g.name, groupId: g.id })))
      .filter(p => (p.translation_es || '').trim())

    const stat = p => statsById[p.id] || EMPTY_STAT
    switch (sortBy) {
      case 'random':
        flat = shuffleArray(flat)
        break
      case 'least_tried':
        flat.sort((a, b) => stat(a).total_attempts - stat(b).total_attempts)
        break
      case 'most_failed':
        flat.sort((a, b) => stat(b).failed_count - stat(a).failed_count)
        break
      case 'never_right':
        // Phrases you have never gotten right — attempted-and-failed first, then untouched.
        flat = flat.filter(p => stat(p).correct_count === 0)
        flat.sort((a, b) => stat(b).failed_count - stat(a).failed_count)
        break
      case 'playlist':
      default:
        break
    }
    if (sessionSize > 0) flat = flat.slice(0, sessionSize)
    setDeck(flat)
    setIndex(0)
    setAnswer('')
    setResult(null)
    setShowHistory(false)
    setFinished(false)
    setSession({ correct: 0, failed: 0 })
    setMissed([])
    // Re-deriving on every stats change would reshuffle mid-session, so statsById is
    // read as a snapshot when the deck is (re)built.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist?.groups, groupFilterKey, sortBy, sessionSize])

  const current = deck[index]
  const currentStat = current ? (statsById[current.id] || EMPTY_STAT) : EMPTY_STAT
  const isLast = deck.length > 0 && index === deck.length - 1

  // Focus the field for each new phrase.
  useEffect(() => {
    if (!result && inputRef.current) inputRef.current.focus()
  }, [index, result])

  async function handleCheck() {
    if (!current || checking || result) return
    if (!answer.trim()) return
    setChecking(true)
    try {
      const res = await evaluatePhrase(current.id, answer, playlist.id, token)
      setResult(res)
      setStatsById(prev => ({ ...prev, [current.id]: { ...res.stats, phrase_id: current.id } }))
      setSession(s => res.is_correct
        ? { ...s, correct: s.correct + 1 }
        : { ...s, failed: s.failed + 1 })
      if (!res.is_correct) {
        setMissed(m => [...m, { id: current.id, es: current.translation_es, expected: res.expected, answer: answer.trim() }])
      }
      // Refresh the visible history so the attempt just made shows up.
      if (showHistory) loadHistory(current.id)
    } catch (err) {
      alert(err.message)
    } finally {
      setChecking(false)
    }
  }

  function handleNext() {
    if (isLast) { setFinished(true); return }
    setIndex(i => i + 1)
    setAnswer('')
    setResult(null)
    setShowHistory(false)
    setHistory([])
  }

  // Try the same phrase again without moving on — the failed attempt is already recorded.
  function handleRetry() {
    setAnswer('')
    setResult(null)
    inputRef.current?.focus()
  }

  const loadHistory = useCallback((phraseId) => {
    setHistoryLoading(true)
    getPhraseEvaluationHistory(phraseId, token)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false))
  }, [token])

  function toggleHistory() {
    const next = !showHistory
    setShowHistory(next)
    if (next && current) loadHistory(current.id)
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function restart() {
    setFinished(false)
    setIndex(0)
    setAnswer('')
    setResult(null)
    setSession({ correct: 0, failed: 0 })
    setMissed([])
    setShowHistory(false)
  }

  // Word-by-word comparison used to point at what went wrong.
  const diffWords = useMemo(() => {
    if (!result || result.is_correct) return null
    const expected = normalizeAnswer(result.expected).split(' ').filter(Boolean)
    const given = normalizeAnswer(answer).split(' ').filter(Boolean)
    return result.expected.split(/\s+/).filter(Boolean).map((w, i) => ({
      word: w,
      ok: given[i] != null && given[i] === expected[i],
    }))
  }, [result, answer])

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="bg-white border-b border-stone-200 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl">🎧</span>
          <span className="text-emerald-700 text-lg font-bold tracking-tight">Listen With Me</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to={`/phrases/${id}`} className="text-stone-500 hover:text-stone-800 text-sm font-semibold transition">
            ← Back to playlist
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

      <main className="flex-1 max-w-3xl w-full mx-auto p-6 flex flex-col">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-4"></div>
            <p>Loading playlist...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center">{error}</div>
        ) : !playlist ? null : (
          <>
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="text-3xl">{LANG_FLAGS[playlist.language] || '🌐'}</span>
                <span className="bg-stone-100 text-stone-500 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                  {LANG_LABELS[playlist.language] || playlist.language}
                </span>
                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                  ✍️ Writing evaluation
                </span>
              </div>
              <h2 className="text-2xl font-bold text-stone-800 tracking-tight">{playlist.name}</h2>
              <p className="text-sm text-stone-500 mt-0.5">
                Read the Spanish and write the phrase in {LANG_LABELS[playlist.language] || 'the target language'}.
              </p>
            </div>

            {/* Filters */}
            <div className="mb-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-700 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all cursor-pointer"
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-stone-400 font-semibold uppercase tracking-wider mr-1">Session:</span>
                {SESSION_SIZES.map(n => (
                  <button
                    key={n}
                    onClick={() => setSessionSize(n)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${sessionSize === n ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-stone-500 border-stone-200 hover:border-emerald-400 hover:text-emerald-700'}`}
                  >
                    {n === 0 ? 'All' : n}
                  </button>
                ))}
              </div>
            </div>

            {groupOptions.length > 0 && (
              <div className="mb-6">
                <span className="block text-[11px] text-stone-400 font-semibold uppercase tracking-wider mb-1.5">Groups:</span>
                <GroupMultiSelect
                  groups={groupOptions}
                  value={groupFilterIds}
                  onChange={setGroupFilterIds}
                  variant="light"
                />
              </div>
            )}

            {finished ? (
              <SessionSummary
                session={session}
                missed={missed}
                playlistId={playlist.id}
                onRestart={restart}
              />
            ) : deck.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                <span className="text-5xl mb-4 block">📭</span>
                <p className="text-stone-500">
                  {sortBy === 'never_right'
                    ? 'Nothing left here — you have gotten every phrase right at least once.'
                    : 'No phrases with a Spanish translation to evaluate here.'}
                </p>
              </div>
            ) : (
              <>
                {/* Progress */}
                <div className="mb-4 flex items-center justify-between text-xs text-stone-400">
                  <span className="font-semibold uppercase tracking-wider">{current.groupName}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-600">✓ {session.correct}</span>
                    <span className="font-bold text-red-500">✗ {session.failed}</span>
                    <span className="font-bold">{index + 1} / {deck.length}</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-stone-200 rounded-full mb-6 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${((index + 1) / deck.length) * 100}%` }}
                  />
                </div>

                {/* Card */}
                <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-10 mb-4">
                  <p className="text-[11px] text-stone-400 font-semibold uppercase tracking-wider mb-2 text-center">
                    🇪🇸 Write this in {LANG_LABELS[playlist.language] || 'the target language'}
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-700 leading-snug text-center mb-6">
                    {current.translation_es}
                  </p>

                  <textarea
                    ref={inputRef}
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (result) handleNext()
                        else handleCheck()
                      }
                    }}
                    disabled={!!result || checking}
                    rows={2}
                    placeholder="Type your answer and press Enter…"
                    className={`w-full text-lg rounded-2xl border-2 px-4 py-3 outline-none transition resize-none disabled:opacity-90 ${
                      result === null
                        ? 'border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'
                        : result.is_correct
                          ? 'border-emerald-400 bg-emerald-50/60 text-emerald-900'
                          : 'border-red-300 bg-red-50/60 text-red-900'
                    }`}
                  />

                  {/* Feedback */}
                  {result && (
                    <div className="mt-4">
                      {result.is_correct ? (
                        <div className="flex items-center gap-2 text-emerald-700 font-bold">
                          <span className="text-2xl">✅</span> Correct!
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-red-600 font-bold">
                            <span className="text-2xl">❌</span> Not quite
                          </div>
                          <div>
                            <p className="text-[11px] text-stone-400 font-semibold uppercase tracking-wider mb-1">Expected</p>
                            <p className="text-lg font-bold leading-snug">
                              {diffWords
                                ? diffWords.map((w, i) => (
                                    <span key={i} className={w.ok ? 'text-stone-700' : 'bg-amber-200/70 text-stone-900 rounded px-1'}>
                                      {w.word}{i < diffWords.length - 1 ? ' ' : ''}
                                    </span>
                                  ))
                                : result.expected}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-stone-400 font-semibold uppercase tracking-wider mb-1">You wrote</p>
                            <p className="text-base text-stone-500 font-mono">{answer.trim() || '—'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lifetime stats for this phrase */}
                  <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-emerald-600 font-bold">✓ {currentStat.correct_count}</span>
                      <span className="text-red-500 font-bold">✗ {currentStat.failed_count}</span>
                      <span className="text-stone-400">{currentStat.total_attempts} attempt{currentStat.total_attempts === 1 ? '' : 's'}</span>
                    </div>
                    <button
                      onClick={toggleHistory}
                      className="text-xs font-bold text-stone-500 hover:text-emerald-700 border border-stone-200 hover:border-emerald-400 rounded-lg px-3 py-1.5 transition"
                    >
                      🕘 {showHistory ? 'Hide' : 'My'} history
                    </button>
                  </div>

                  {showHistory && (
                    <AttemptHistory loading={historyLoading} history={history} />
                  )}
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => { if (index > 0) { setIndex(i => i - 1); setAnswer(''); setResult(null); setShowHistory(false) } }}
                    disabled={index === 0}
                    className="flex items-center gap-2 bg-white border border-stone-200 text-stone-700 font-bold px-5 py-3 rounded-2xl transition hover:border-stone-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  {result && !result.is_correct && (
                    <button
                      onClick={handleRetry}
                      className="text-xs text-stone-500 hover:text-stone-800 font-bold border border-stone-200 hover:border-stone-400 rounded-xl px-4 py-2 transition"
                    >
                      ↻ Try again
                    </button>
                  )}
                  {result ? (
                    <button
                      onClick={handleNext}
                      className={`flex items-center gap-2 text-white font-bold px-5 py-3 rounded-2xl transition shadow-sm ${isLast ? 'bg-stone-800 hover:bg-stone-700' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                    >
                      {isLast ? 'Finish' : 'Next'} →
                    </button>
                  ) : (
                    <button
                      onClick={handleCheck}
                      disabled={checking || !answer.trim()}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-3 rounded-2xl transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {checking ? 'Checking…' : 'Check'}
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-stone-300 text-center mt-4">
                  Tip: Enter to check, Enter again for the next phrase · Shift+Enter for a line break
                </p>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function AttemptHistory({ loading, history }) {
  if (loading) {
    return <p className="mt-4 text-xs text-stone-400">Loading history…</p>
  }
  if (history.length === 0) {
    return <p className="mt-4 text-xs text-stone-400">No attempts recorded for this phrase yet.</p>
  }
  return (
    <div className="mt-4 border-t border-stone-100 pt-4">
      <p className="text-[11px] text-stone-400 font-semibold uppercase tracking-wider mb-2">
        Past attempts ({history.length})
      </p>
      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {history.map(a => (
          <div
            key={a.id}
            className={`flex items-start gap-2 rounded-xl px-3 py-2 border text-sm ${a.is_correct ? 'bg-emerald-50/60 border-emerald-100' : 'bg-red-50/60 border-red-100'}`}
          >
            <span className="leading-tight">{a.is_correct ? '✅' : '❌'}</span>
            <div className="flex-1 min-w-0">
              <p className={`font-mono break-words ${a.is_correct ? 'text-emerald-900' : 'text-red-900'}`}>
                {a.user_answer || <span className="italic opacity-60">(empty)</span>}
              </p>
              {!a.is_correct && (
                <p className="text-xs text-stone-500 mt-0.5">Expected: <span className="font-mono">{a.expected}</span></p>
              )}
            </div>
            <span className="text-[10px] text-stone-400 flex-shrink-0 whitespace-nowrap">
              {new Date(a.created_at).toLocaleDateString()} {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SessionSummary({ session, missed, playlistId, onRestart }) {
  const total = session.correct + session.failed
  const pct = total > 0 ? Math.round((session.correct / total) * 100) : 0
  return (
    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-8 text-center">
      <span className="text-5xl block mb-3">{pct >= 80 ? '🎉' : pct >= 50 ? '💪' : '📚'}</span>
      <h3 className="text-2xl font-bold text-stone-800 mb-1">Session complete</h3>
      <p className="text-stone-500 mb-6">
        <span className="text-emerald-600 font-bold">{session.correct} correct</span>
        {' · '}
        <span className="text-red-500 font-bold">{session.failed} failed</span>
        {total > 0 && <> · {pct}% accuracy</>}
      </p>

      {missed.length > 0 && (
        <div className="text-left mb-6">
          <p className="text-[11px] text-stone-400 font-semibold uppercase tracking-wider mb-2">
            What you missed
          </p>
          <div className="space-y-2">
            {missed.map((m, i) => (
              <div key={`${m.id}-${i}`} className="bg-red-50/60 border border-red-100 rounded-xl px-3 py-2">
                <p className="text-sm text-emerald-700 font-semibold">{m.es}</p>
                <p className="text-sm text-stone-800 font-bold mt-0.5">{m.expected}</p>
                <p className="text-xs text-stone-500 font-mono mt-0.5">you: {m.answer || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onRestart}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-2xl transition"
        >
          Practice again
        </button>
        <Link
          to={`/phrases/${playlistId}`}
          className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold px-6 py-3 rounded-2xl transition"
        >
          Back to playlist
        </Link>
      </div>
    </div>
  )
}
