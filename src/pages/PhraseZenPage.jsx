import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listPhrasePlaylists, getPhrasePlaylist, generatePollyAudio, logPhraseZenListen } from '../api/phrases'
import { listStoryPhrasePlaylists } from '../api/stories'

// ── Config options ────────────────────────────────────────────────────────────
const ORDER_OPTIONS = [
  { value: 'least_heard', label: 'Least heard', icon: '🌱' },
  { value: 'newest',      label: 'Newest',      icon: '🆕' },
  { value: 'oldest',      label: 'Oldest',      icon: '📅' },
  { value: 'random',      label: 'Random',      icon: '🎲' },
]
const COUNT_OPTIONS  = [5, 10, 20, 30, 0] // 0 = all
const REPEAT_OPTIONS = [1, 2, 3, 4, 5]
const PAUSE_OPTIONS  = [0.5, 1, 1.5, 2, 3] // seconds between phrases (and between repeats)
const MINUTE_OPTIONS = [5, 10, 15, 20, 30] // total session length (time mode)

function sortPhrases(list, order) {
  const arr = [...list]
  switch (order) {
    case 'random':
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    case 'newest':
      return arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    case 'oldest':
      return arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    case 'least_heard':
    default:
      // Fewest Zen listens first (independent from reviews), oldest as tiebreak.
      return arr.sort((a, b) => ((a.zen_count || 0) - (b.zen_count || 0)) || (new Date(a.created_at) - new Date(b.created_at)))
  }
}

// ── Setup Screen ──────────────────────────────────────────────────────────────
function SetupScreen({ onStart, initialPlaylistId }) {
  const { token } = useAuth()
  const [normal, setNormal] = useState([])
  const [fromStories, setFromStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [playlistId, setPlaylistId] = useState(initialPlaylistId || null)

  const [order, setOrder]     = useState('least_heard')
  const [count, setCount]     = useState(10)
  const [repeats, setRepeats] = useState(2)
  const [pause, setPause]     = useState(1.5)
  const [voice, setVoice]     = useState('female')
  const [sessionMode, setSessionMode] = useState('once') // 'once' | 'time'
  const [minutes, setMinutes] = useState(10)

  useEffect(() => {
    Promise.all([
      listPhrasePlaylists(token).catch(() => []),
      listStoryPhrasePlaylists(token).catch(() => []),
    ]).then(([n, s]) => { setNormal(n); setFromStories(s) })
      .finally(() => setLoading(false))
  }, [token])

  const allById = {}
  normal.forEach(p => { allById[p.id] = { id: p.id, name: p.name, type: 'normal' } })
  fromStories.forEach(p => { allById[p.id] = { id: p.id, name: p.name, type: 'story' } })
  const selected = playlistId ? allById[playlistId] : null

  function handleStart() {
    if (!playlistId) return
    onStart({
      playlistId, order, count, repeats, pauseMs: Math.round(pause * 1000), voice,
      sessionMode, timeMs: sessionMode === 'time' ? minutes * 60000 : 0,
    })
  }

  if (loading) return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
    </div>
  )

  const Chip = ({ active, onClick, children }) => (
    <button
      onClick={onClick}
      className={`flex-1 min-w-[48px] py-2.5 px-3 rounded-xl border text-sm font-bold transition-all ${
        active ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-stone-900 border-stone-700 text-stone-300 hover:border-stone-500'
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between border-b border-stone-800">
        <Link to="/phrases" className="text-stone-500 hover:text-stone-300 transition text-sm font-medium">← Phrases</Link>
        <div className="flex items-center gap-2"><span className="text-2xl">🧘</span><span className="font-bold text-lg">Zen · Phrases</span></div>
        <Link to="/phrases/zen/stats" className="text-stone-500 hover:text-emerald-400 transition text-sm font-medium">📊 Stats</Link>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 py-10 max-w-lg mx-auto w-full gap-7">
        <p className="text-stone-400 text-sm text-center">Relax and listen to your phrases on a loop.</p>

        {/* Playlist picker */}
        <section className="w-full">
          <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-3">Playlist</label>
          {normal.length === 0 && fromStories.length === 0 ? (
            <p className="text-sm text-stone-600 bg-stone-900 rounded-xl px-4 py-3 border border-stone-800">
              You have no phrase playlists yet.
            </p>
          ) : (
            <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
              {normal.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-1.5">💬 Your playlists</p>
                  <div className="flex flex-col gap-1.5">
                    {normal.map(p => (
                      <PlaylistRow key={p.id} p={p} active={playlistId === p.id} onClick={() => setPlaylistId(p.id)} />
                    ))}
                  </div>
                </div>
              )}
              {fromStories.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-1.5">📖 From stories</p>
                  <div className="flex flex-col gap-1.5">
                    {fromStories.map(p => (
                      <PlaylistRow key={p.id} p={{ ...p, phrase_count: p.phrase_count }} active={playlistId === p.id} onClick={() => setPlaylistId(p.id)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Order */}
        <section className="w-full">
          <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-3">Order</label>
          <div className="grid grid-cols-2 gap-2">
            {ORDER_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setOrder(o.value)}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm font-semibold transition-all ${
                  order === o.value ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-stone-900 border-stone-700 text-stone-300 hover:border-stone-500'
                }`}>
                <span>{o.icon}</span> {o.label}
              </button>
            ))}
          </div>
        </section>

        {/* Count */}
        <section className="w-full">
          <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-3">How many phrases</label>
          <div className="flex gap-2">
            {COUNT_OPTIONS.map(n => (
              <Chip key={n} active={count === n} onClick={() => setCount(n)}>{n === 0 ? 'All' : n}</Chip>
            ))}
          </div>
        </section>

        {/* Repeats */}
        <section className="w-full">
          <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-3">Repeat each phrase</label>
          <div className="flex gap-2">
            {REPEAT_OPTIONS.map(n => (
              <Chip key={n} active={repeats === n} onClick={() => setRepeats(n)}>{n}×</Chip>
            ))}
          </div>
        </section>

        {/* Pause */}
        <section className="w-full">
          <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-3">Pause (between phrases &amp; repeats)</label>
          <div className="flex gap-2">
            {PAUSE_OPTIONS.map(n => (
              <Chip key={n} active={pause === n} onClick={() => setPause(n)}>{n}s</Chip>
            ))}
          </div>
        </section>

        {/* Session length: one pass through the phrases, or loop for a set time */}
        <section className="w-full">
          <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-3">Stop after</label>
          <div className="flex gap-2 mb-3">
            <Chip active={sessionMode === 'once'} onClick={() => setSessionMode('once')}>🔁 One pass</Chip>
            <Chip active={sessionMode === 'time'} onClick={() => setSessionMode('time')}>⏱️ A set time</Chip>
          </div>
          {sessionMode === 'time' && (
            <>
              <div className="flex gap-2">
                {MINUTE_OPTIONS.map(n => (
                  <Chip key={n} active={minutes === n} onClick={() => setMinutes(n)}>{n}m</Chip>
                ))}
              </div>
              <p className="text-[11px] text-stone-600 mt-2">
                Keeps looping — when it reaches the end it re-picks a fresh set (e.g. the least-heard again) until the time is up.
              </p>
            </>
          )}
        </section>

        {/* Voice — only for normal vocab playlists (story playlists use the story audio) */}
        {selected?.type === 'normal' && (
          <section className="w-full">
            <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-3">Voice</label>
            <div className="flex gap-2">
              <Chip active={voice === 'female'} onClick={() => setVoice('female')}>👩 Female</Chip>
              <Chip active={voice === 'male'} onClick={() => setVoice('male')}>👨 Male</Chip>
            </div>
          </section>
        )}
        {selected?.type === 'story' && (
          <p className="w-full text-[11px] text-stone-600 bg-stone-900 rounded-xl px-4 py-3 border border-stone-800">
            🎧 This playlist uses the story's own audio.
          </p>
        )}

        {!selected && (
          <p className="w-full text-xs text-emerald-500/80 text-center">Select a playlist above to begin.</p>
        )}
        <button
          onClick={handleStart}
          disabled={!playlistId}
          className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all shadow-2xl shadow-emerald-900/40"
        >
          🧘 Start Zen session
        </button>
      </main>
    </div>
  )
}

function PlaylistRow({ p, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
        active ? 'bg-emerald-600/20 border-emerald-600 text-emerald-300' : 'bg-stone-900 border-stone-800 text-stone-300 hover:border-stone-600'
      }`}>
      <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
      <span className="text-xs text-stone-600 flex-shrink-0">{p.phrase_count ?? ''}</span>
    </button>
  )
}

// ── Player Screen ─────────────────────────────────────────────────────────────
function PlayerScreen({ config, onEnd }) {
  const { token } = useAuth()
  const audioRef = useRef(null)

  const queueRef   = useRef([])
  const idxRef     = useRef(0)
  const repeatRef  = useRef(0)
  const rafRef     = useRef(null)
  const timeoutRef = useRef(null)
  const pendingRef = useRef(null)      // fn to run on resume if paused during a gap
  const isSegmentRef = useRef(false)
  const currentUrlRef = useRef(null)
  const preloadPoolRef = useRef([])
  const cancelledRef = useRef(false)
  const sessionStartRef = useRef(0)    // ms timestamp when playback started (time mode)
  const totalPlayedRef = useRef(0)     // phrases fully listened (across cycles)

  const [phase, setPhase]   = useState('loading') // loading | generating | preloading | playing | error
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError]   = useState('')
  const [queue, setQueue]   = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [repeatNo, setRepeatNo]     = useState(1)
  const [isPlaying, setIsPlaying]   = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [remainingSec, setRemainingSec]   = useState(null)

  function clearTimers() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
  }

  const watchSegmentEnd = useCallback((end) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const tick = () => {
      const audio = audioRef.current
      if (!audio || audio.paused) { rafRef.current = null; return }
      if (audio.currentTime >= end) { audio.pause(); rafRef.current = null; onPhraseEnded(); return }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startPlay = useCallback((desc) => {
    const audio = audioRef.current
    if (!audio || !desc) return
    clearTimers()
    isSegmentRef.current = !!desc.isSegment
    const begin = () => {
      try { audio.currentTime = desc.isSegment ? desc.start : 0 } catch { /* ignore */ }
      audio.play().then(() => setIsPlaying(true)).catch(e => { if (e && e.name !== 'AbortError') console.error(e) })
      if (desc.isSegment) watchSegmentEnd(desc.end)
    }
    if (currentUrlRef.current === desc.url && audio.readyState >= 2) {
      begin()
    } else {
      currentUrlRef.current = desc.url
      audio.src = desc.url
      const onReady = () => { audio.removeEventListener('canplay', onReady); begin() }
      audio.addEventListener('canplay', onReady)
      audio.load()
    }
  }, [watchSegmentEnd])

  function schedule(fn, ms) {
    pendingRef.current = fn
    timeoutRef.current = setTimeout(() => { pendingRef.current = null; fn() }, ms)
  }

  // Fetches the playlist, sorts/limits by config, generates any missing Polly audio
  // and preloads everything. Returns the descriptor list (empty if none playable).
  // Called on start (showProgress) and again each cycle in time mode (fresh data, so
  // e.g. "least heard" re-picks a different set as zen counts update).
  const buildDescriptors = useCallback(async (showProgress) => {
    const pl = await getPhrasePlaylist(config.playlistId, token)
    let phrases = (pl.groups || []).flatMap(g => g.phrases || []).filter(p => p && p.text)
    phrases = sortPhrases(phrases, config.order)
    if (config.count > 0) phrases = phrases.slice(0, config.count)
    if (phrases.length === 0) return []

    const orderIndex = new Map(phrases.map((p, i) => [p.id, i]))
    const descriptors = []
    const needGen = []
    for (const p of phrases) {
      if (p.source_audio_url) {
        descriptors.push({ id: p.id, text: p.text, url: p.source_audio_url, isSegment: true,
          start: (p.source_start_ms || 0) / 1000, end: (p.source_end_ms || 0) / 1000 })
      } else {
        const cached = config.voice === 'male'
          ? (p.polly_audio_url_male || p.polly_audio_url_female)
          : (p.polly_audio_url_female || p.polly_audio_url_male)
        if (cached) descriptors.push({ id: p.id, text: p.text, url: cached, isSegment: false })
        else needGen.push(p)
      }
    }

    if (needGen.length > 0) {
      if (showProgress) { setPhase('generating'); setProgress({ done: 0, total: needGen.length }) }
      for (let i = 0; i < needGen.length; i++) {
        if (cancelledRef.current) return []
        try {
          const { audio_url } = await generatePollyAudio(needGen[i].id, config.voice, token)
          descriptors.push({ id: needGen[i].id, text: needGen[i].text, url: audio_url, isSegment: false })
        } catch (e) { console.error('zen generate audio failed', needGen[i].id, e) }
        if (showProgress) setProgress({ done: i + 1, total: needGen.length })
      }
    }

    descriptors.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0))
    if (descriptors.length === 0) return []

    if (showProgress) { setPhase('preloading'); setProgress({ done: 0, total: descriptors.length }) }
    const uniqueUrls = [...new Set(descriptors.map(d => d.url))]
    let pdone = 0
    preloadPoolRef.current.forEach(a => { a.src = '' })
    preloadPoolRef.current = []
    await Promise.all(uniqueUrls.map(url => new Promise(resolve => {
      const a = new Audio()
      a.preload = 'auto'
      const done = () => { pdone++; if (showProgress) setProgress({ done: Math.min(pdone, descriptors.length), total: descriptors.length }); resolve() }
      a.addEventListener('canplaythrough', done, { once: true })
      a.addEventListener('error', done, { once: true })
      setTimeout(done, 8000)
      a.src = url
      preloadPoolRef.current.push(a)
      a.load()
    })))
    return descriptors
  }, [config, token])

  // Time mode: at the end of a cycle, rebuild a fresh queue and keep going.
  const recalcAndContinue = useCallback(async () => {
    setRecalculating(true)
    let descs = []
    try { descs = await buildDescriptors(false) } catch (e) { console.error('zen recalc failed', e) }
    setRecalculating(false)
    if (cancelledRef.current) return
    if (!descs || descs.length === 0) { onEnd(totalPlayedRef.current); return }
    queueRef.current = descs
    setQueue(descs)
    idxRef.current = 0
    repeatRef.current = 0
    setCurrentIdx(0)
    setRepeatNo(1)
    startPlay(descs[0])
  }, [buildDescriptors, onEnd, startPlay])

  const advance = useCallback(() => {
    // Time mode: stop once the total time is reached (checked at each phrase boundary).
    if (config.sessionMode === 'time' && (Date.now() - sessionStartRef.current) >= config.timeMs) {
      onEnd(totalPlayedRef.current)
      return
    }
    const next = idxRef.current + 1
    if (next < queueRef.current.length) {
      idxRef.current = next
      repeatRef.current = 0
      setCurrentIdx(next)
      setRepeatNo(1)
      startPlay(queueRef.current[next])
      return
    }
    // Reached the end of the current cycle.
    if (config.sessionMode === 'time') { recalcAndContinue(); return }
    onEnd(totalPlayedRef.current)
  }, [config, onEnd, startPlay, recalcAndContinue])

  function onPhraseEnded() {
    repeatRef.current += 1
    if (repeatRef.current < config.repeats) {
      // Same pause between repeats as between phrases.
      setRepeatNo(repeatRef.current + 1)
      schedule(() => startPlay(queueRef.current[idxRef.current]), config.pauseMs)
    } else {
      // Log one independent Zen listen for this phrase (after all its repeats).
      const d = queueRef.current[idxRef.current]
      if (d) logPhraseZenListen(d.id, config.playlistId, token).catch(() => {})
      totalPlayedRef.current += 1
      schedule(advance, config.pauseMs)
    }
  }

  // 'ended' handler for full-file (non-segment) audio
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnded = () => { if (!isSegmentRef.current) onPhraseEnded() }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  // Prepare on mount: build the first queue, then switch to the playing phase.
  useEffect(() => {
    cancelledRef.current = false
    ;(async () => {
      try {
        const descs = await buildDescriptors(true)
        if (cancelledRef.current) return
        if (!descs || descs.length === 0) { setError('No audio available for these phrases.'); setPhase('error'); return }
        queueRef.current = descs
        setQueue(descs)
        idxRef.current = 0
        repeatRef.current = 0
        totalPlayedRef.current = 0
        setCurrentIdx(0)
        setRepeatNo(1)
        setPhase('playing') // playback starts in the effect below, once <audio> is mounted
      } catch (e) {
        if (!cancelledRef.current) { setError(e.message); setPhase('error') }
      }
    })()
    return () => {
      cancelledRef.current = true
      clearTimers()
      const audio = audioRef.current
      if (audio) { audio.pause(); audio.src = '' }
      preloadPoolRef.current.forEach(a => { a.src = '' })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Start playback once the <audio> element is mounted (phase === 'playing').
  // Guarantees audioRef.current exists so the src actually gets set.
  useEffect(() => {
    if (phase === 'playing' && audioRef.current && queueRef.current.length) {
      if (!sessionStartRef.current) sessionStartRef.current = Date.now()
      startPlay(queueRef.current[idxRef.current])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Countdown for time-mode sessions.
  useEffect(() => {
    if (phase !== 'playing' || config.sessionMode !== 'time') return
    const tick = () => {
      const start = sessionStartRef.current || Date.now()
      setRemainingSec(Math.max(0, Math.ceil((config.timeMs - (Date.now() - start)) / 1000)))
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [phase, config])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      // pause everything (keep pending gap so we can resume it)
      audio.pause()
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
      setIsPlaying(false)
    } else {
      if (pendingRef.current) {
        const fn = pendingRef.current; pendingRef.current = null; fn()
      } else {
        audio.play().then(() => {
          setIsPlaying(true)
          if (isSegmentRef.current) {
            const d = queueRef.current[idxRef.current]
            if (d) watchSegmentEnd(d.end)
          }
        }).catch(e => { if (e && e.name !== 'AbortError') console.error(e) })
      }
    }
  }

  function skipNext() {
    clearTimers()
    pendingRef.current = null
    advance()
  }

  // ── render ──────────────────────────────────────────────────────────────────
  if (phase === 'error') return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="text-5xl">😔</span>
      <p className="text-stone-400">{error}</p>
      <button onClick={() => onEnd(0)} className="bg-stone-800 text-stone-300 font-bold px-6 py-3 rounded-2xl">Back</button>
    </div>
  )

  if (phase !== 'playing') {
    const label = phase === 'generating' ? 'Generating audio…' : phase === 'preloading' ? 'Preloading audio…' : 'Loading…'
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center gap-6 px-6">
        <div className="w-20 h-20 rounded-3xl bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center text-4xl animate-pulse">🧘</div>
        <p className="text-stone-300 font-semibold">{label}</p>
        {progress.total > 0 && (
          <div className="w-full max-w-xs">
            <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-center text-xs text-stone-600 mt-2 font-mono">{progress.done} / {progress.total}</p>
          </div>
        )}
        <p className="text-xs text-stone-600 text-center max-w-xs">Preparing everything so playback is smooth.</p>
      </div>
    )
  }

  const current = queue[currentIdx]
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col">
      <audio ref={audioRef} />

      {recalculating && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          <p className="text-sm text-stone-400 font-semibold">Re-picking a fresh set…</p>
        </div>
      )}
      <header className="px-6 py-4 flex items-center justify-between border-b border-stone-800/50">
        <button onClick={() => onEnd(currentIdx + 1)} className="text-stone-600 hover:text-stone-400 transition text-sm">✕ Exit</button>
        <div className="flex flex-col items-center">
          <span className="text-xs text-stone-600 font-medium">Zen · Phrases</span>
          <span className="text-xs text-stone-500">{currentIdx + 1} / {queue.length}</span>
        </div>
        {config.sessionMode === 'time'
          ? <div className="text-sm font-mono text-emerald-400" title="Time left">⏱️ {fmtMMSS(remainingSec)}</div>
          : <div className="text-sm text-stone-700 font-mono">{config.repeats}×</div>}
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-md mx-auto w-full gap-8">
        <div className="w-40 h-40 rounded-[2rem] bg-gradient-to-br from-emerald-600/20 to-stone-900 border border-stone-800 shadow-2xl flex items-center justify-center text-6xl">
          {isPlaying ? '🔊' : '🎧'}
        </div>

        <div className="text-center w-full">
          <p className="text-2xl sm:text-3xl font-bold text-stone-100 leading-snug">{current?.text}</p>
        </div>

        {/* Repeat dots */}
        <div className="flex gap-1.5 justify-center">
          {Array.from({ length: config.repeats }).map((_, i) => (
            <div key={i} className={`h-2 rounded-full transition-all duration-300 ${
              i < repeatNo ? 'w-6 bg-emerald-500' : 'w-2 bg-stone-700'
            }`} />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-8">
          <button onClick={togglePlay}
            className="w-16 h-16 bg-emerald-600 hover:bg-emerald-500 active:scale-95 rounded-full flex items-center justify-center transition-all shadow-2xl shadow-emerald-900/50">
            {isPlaying
              ? <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              : <svg className="w-7 h-7 text-white translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
          </button>
          <button onClick={skipNext} className="w-12 h-12 flex items-center justify-center text-stone-500 hover:text-stone-300 transition" title="Next phrase">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/></svg>
          </button>
        </div>

        {/* Up next */}
        {queue.length > 1 && currentIdx + 1 < queue.length && (
          <div className="w-full">
            <p className="text-xs text-stone-700 uppercase tracking-widest font-bold mb-2 text-center">Up next</p>
            <div className="flex flex-col gap-1.5">
              {queue.slice(currentIdx + 1, currentIdx + 3).map((d, i) => (
                <div key={d.id} className="flex items-center gap-3 bg-stone-900/50 rounded-xl px-3 py-2 border border-stone-800/50">
                  <span className="text-xs text-stone-700 font-mono w-4">{i + 1}</span>
                  <p className="text-sm text-stone-400 font-medium truncate flex-1">{d.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ── Complete Screen ───────────────────────────────────────────────────────────
function CompleteScreen({ count, onRestart }) {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center px-6 text-center gap-8">
      <div className="w-24 h-24 rounded-3xl bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center text-5xl">🧘</div>
      <div>
        <h2 className="text-3xl font-bold mb-2">Session complete!</h2>
        <p className="text-stone-400 text-lg">You listened to <span className="text-emerald-400 font-bold">{count}</span> {count === 1 ? 'phrase' : 'phrases'}.</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button onClick={onRestart} className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-4 rounded-2xl transition-all">New session</button>
        <Link to="/phrases" className="w-full bg-stone-900 hover:bg-stone-800 text-stone-300 font-bold py-4 rounded-2xl transition-all text-center block">Back to phrases</Link>
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function PhraseZenPage() {
  const [params] = useSearchParams()
  const initialPlaylistId = params.get('playlist') ? Number(params.get('playlist')) : null
  const [screen, setScreen] = useState('setup')
  const [config, setConfig] = useState(null)
  const [count, setCount] = useState(0)

  if (screen === 'setup') return <SetupScreen initialPlaylistId={initialPlaylistId} onStart={cfg => { setConfig(cfg); setScreen('player') }} />
  if (screen === 'player') return <PlayerScreen config={config} onEnd={n => { setCount(n); setScreen('complete') }} />
  return <CompleteScreen count={count} onRestart={() => { setConfig(null); setScreen('setup') }} />
}

function fmtMMSS(sec) {
  if (sec == null || isNaN(sec)) return '--:--'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
