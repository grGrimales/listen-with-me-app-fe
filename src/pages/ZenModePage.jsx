import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getPlaylists, getStory, getZenStories, logZenListen } from '../api/stories'

function ZenPlaylistCombobox({ playlists, selectedId, onChange }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)

  const selected = playlists.find(p => p.id === selectedId)
  const displayValue = open ? search : (selected ? selected.name : 'All stories')
  const filtered = playlists.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch('') }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function select(id) { onChange(id); setOpen(false); setSearch('') }

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => { setOpen(true); setSearch(''); setTimeout(() => inputRef.current?.focus(), 0) }}
        className={`flex items-center gap-2 border rounded-xl px-3 py-3 bg-stone-900 cursor-text transition-all ${open ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-stone-700 hover:border-stone-500'}`}
      >
        <svg className="w-4 h-4 text-stone-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h10M4 18h10" />
        </svg>
        <input
          ref={inputRef}
          value={displayValue}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => { setOpen(true); setSearch('') }}
          readOnly={!open}
          placeholder="All stories"
          className="flex-1 outline-none text-sm bg-transparent text-stone-200 placeholder-stone-600 cursor-pointer"
        />
        {selectedId && (
          <button onClick={e => { e.stopPropagation(); select(null) }} className="text-stone-600 hover:text-stone-400 flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
        <svg className={`w-4 h-4 text-stone-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl z-30 overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            <button
              onClick={() => select(null)}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${!selectedId ? 'bg-emerald-600/20 text-emerald-400 font-semibold' : 'text-stone-400 hover:bg-stone-800'}`}
            >
              <span>📚</span> All stories
            </button>
            {filtered.length === 0 && search && (
              <p className="px-4 py-3 text-sm text-stone-600 italic">No results for "{search}"</p>
            )}
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => select(p.id)}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${selectedId === p.id ? 'bg-emerald-600/20 text-emerald-400 font-semibold' : 'text-stone-400 hover:bg-stone-800'}`}
              >
                {p.is_favorite
                  ? <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  : <svg className="w-4 h-4 text-stone-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h10M4 18h10" /></svg>
                }
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-xs text-stone-600 flex-shrink-0">{p.story_count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const SORT_OPTIONS = [
  { value: 'random',      label: 'Random',       icon: '🎲' },
  { value: 'newest',      label: 'Newest',        icon: '🆕' },
  { value: 'oldest',      label: 'Oldest',        icon: '📅' },
  { value: 'least_played', label: 'Least played', icon: '🌱' },
]

const COUNT_OPTIONS = [3, 5, 10, 15, 20]

// ── Setup Screen ─────────────────────────────────────────────────────────────
function SetupScreen({ onStart }) {
  const { token } = useAuth()
  const [playlists, setPlaylists]   = useState([])
  const [playlistId, setPlaylistId] = useState(null)
  const [sort, setSort]             = useState('random')
  const [count, setCount]           = useState(5)
  const [infinite, setInfinite]     = useState(false)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    getPlaylists(token)
      .then(setPlaylists)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [token])

  function handleStart() {
    onStart({ playlistId, sort, count: infinite ? 0 : count, infinite })
  }

  if (loading) return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between border-b border-stone-800">
        <Link to="/" className="text-stone-500 hover:text-stone-300 transition text-sm font-medium">← Library</Link>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧘</span>
          <span className="font-bold text-lg text-stone-100">Zen Mode</span>
        </div>
        <div className="w-24" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-lg mx-auto w-full gap-8">
        <div className="text-center">
          <p className="text-stone-400 text-sm mt-2">Set up your listening session and relax.</p>
        </div>

        {/* Playlist */}
        <section className="w-full">
          <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-3">Playlist</label>
          <ZenPlaylistCombobox
            playlists={playlists}
            selectedId={playlistId}
            onChange={setPlaylistId}
          />
          {/* Favorite shortcuts */}
          {playlists.some(p => p.is_favorite) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {playlists.filter(p => p.is_favorite).map(p => (
                <button
                  key={p.id}
                  onClick={() => setPlaylistId(playlistId === p.id ? null : p.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    playlistId === p.id
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-stone-900 text-stone-300 border-stone-700 hover:border-emerald-500 hover:text-emerald-400'
                  }`}
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Order */}
        <section className="w-full">
          <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-3">Playback order</label>
          <div className="grid grid-cols-2 gap-2">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSort(opt.value)}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm font-semibold transition-all ${
                  sort === opt.value
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-stone-900 border-stone-700 text-stone-300 hover:border-stone-500'
                }`}
              >
                <span>{opt.icon}</span> {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Count + Infinite */}
        <section className="w-full">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold uppercase tracking-widest text-stone-500">Number of stories</label>
            <button
              onClick={() => setInfinite(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                infinite
                  ? 'bg-violet-600 border-violet-600 text-white'
                  : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-500'
              }`}
            >
              ∞ Infinite
            </button>
          </div>
          {!infinite && (
            <div className="flex gap-2 flex-wrap">
              {COUNT_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`flex-1 min-w-[50px] py-3 rounded-2xl border text-sm font-bold transition-all ${
                    count === n
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-stone-900 border-stone-700 text-stone-300 hover:border-stone-500'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          {infinite && (
            <p className="text-xs text-stone-600 bg-stone-900 rounded-2xl px-4 py-3 border border-stone-800">
              The session will repeat stories indefinitely until you stop it.
            </p>
          )}
        </section>

        <button
          onClick={handleStart}
          className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-4 rounded-2xl transition-all shadow-2xl shadow-emerald-900/40 text-base"
        >
          🧘 Start Zen session
        </button>
      </main>
    </div>
  )
}

// ── Player Screen ─────────────────────────────────────────────────────────────
function PlayerScreen({ config, onEnd }) {
  const { token } = useAuth()
  const audioRef  = useRef(null)

  // Stable refs for values used inside audio event callbacks
  const queueRef      = useRef([])
  const idxRef        = useRef(0)
  const parasRef      = useRef([])
  const paraIdxRef    = useRef(0)
  const loggedRef     = useRef(new Set())
  const countRef      = useRef(0)
  const autoPlayRef   = useRef(false)   // true when advancing stories automatically

  // Rendered state (drives UI)
  const [queue, setQueueState]       = useState([])
  const [currentIdx, setCurrentIdx]  = useState(0)
  const [detail, setDetail]          = useState(null)   // full story with paragraphs
  const [paraIdx, setParaIdx]        = useState(0)
  const [isPlaying, setIsPlaying]    = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]      = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [loadingQueue, setLoadingQueue]  = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError]            = useState('')

  // ── helpers ────────────────────────────────────────────────────────────────

  function setQueue(stories) {
    queueRef.current = stories
    setQueueState(stories)
  }

  const logListen = useCallback(async (storyId) => {
    if (loggedRef.current.has(storyId)) return
    loggedRef.current.add(storyId)
    countRef.current += 1
    setCompletedCount(countRef.current)
    try { await logZenListen(storyId, token) }
    catch (e) { console.error('zen listen log failed', e) }
  }, [token])

  const advanceStory = useCallback(() => {
    const q   = queueRef.current
    const next = idxRef.current + 1
    autoPlayRef.current = true
    if (next < q.length) {
      idxRef.current = next
      paraIdxRef.current = 0
      setCurrentIdx(next)
    } else if (config.infinite) {
      const reshuffled = [...q].sort(() => Math.random() - 0.5)
      queueRef.current = reshuffled
      setQueueState(reshuffled)
      idxRef.current = 0
      paraIdxRef.current = 0
      setCurrentIdx(0)
    } else {
      onEnd(countRef.current)
    }
  }, [config.infinite, onEnd])

  // ── load queue on mount ────────────────────────────────────────────────────

  useEffect(() => {
    async function loadQueue() {
      try {
        const stories = await getZenStories(token, {
          playlistId: config.playlistId,
          limit: config.infinite ? 0 : config.count,
          sort: config.sort,
        })
        if (!stories.length) { setError('No stories available with this configuration.'); return }
        setQueue(stories)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoadingQueue(false)
      }
    }
    loadQueue()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── fetch full story detail when the current story changes ───────────────
  // Depends on the story ID (not just index) so it fires when the queue
  // loads asynchronously after the initial render.

  const currentStoryId = queue[currentIdx]?.id

  useEffect(() => {
    if (!currentStoryId) return
    setDetail(null)
    setParaIdx(0)
    paraIdxRef.current = 0
    parasRef.current = []
    setLoadingDetail(true)

    getStory(currentStoryId, token)
      .then(full => {
        const voice = full.voices?.[0]
        const paras = voice ? [] : (full.paragraphs || []).filter(p => p.audio_url)
        parasRef.current = paras
        setDetail({ ...full, _voice: voice, _paras: paras })
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingDetail(false))
  }, [currentStoryId, token])

  // ── load first paragraph audio when story detail arrives ─────────────────
  // Only fires on story change. Paragraph-to-paragraph advance is handled
  // directly inside onEnded to avoid re-loading without auto-play.

  useEffect(() => {
    if (!detail || !audioRef.current) return
    const audio = audioRef.current
    audio.pause()
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)

    const src = detail._voice
      ? detail._voice.audio_url
      : detail._paras[0]?.audio_url

    if (src) {
      audio.src = src
      audio.load()
      if (autoPlayRef.current) {
        autoPlayRef.current = false
        audio.play().catch(e => { if (e.name !== 'AbortError') console.error(e) })
      }
    }
  }, [detail])

  // ── audio event handlers ───────────────────────────────────────────────────

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTime     = () => setCurrentTime(audio.currentTime)
    const onDuration = () => setDuration(audio.duration || 0)
    const onPlay     = () => setIsPlaying(true)
    const onPause    = () => setIsPlaying(false)
    const onEnded    = async () => {
      // voice track = whole story in one file
      if (detail?._voice) {
        await logListen(queueRef.current[idxRef.current]?.id)
        advanceStory()
        return
      }

      // paragraph mode: advance to next paragraph and auto-play it
      const nextPara = paraIdxRef.current + 1
      if (nextPara < parasRef.current.length) {
        const src = parasRef.current[nextPara].audio_url
        paraIdxRef.current = nextPara
        setParaIdx(nextPara)
        // load & play next paragraph directly — don't go through useEffect
        audio.src = src
        audio.load()
        await new Promise(resolve => setTimeout(resolve, 800))
        audio.play().catch(e => { if (e.name !== 'AbortError') console.error(e) })
      } else {
        // all paragraphs done → log + advance to next story
        await logListen(queueRef.current[idxRef.current]?.id)
        advanceStory()
      }
    }

    audio.addEventListener('timeupdate',     onTime)
    audio.addEventListener('durationchange', onDuration)
    audio.addEventListener('play',           onPlay)
    audio.addEventListener('pause',          onPause)
    audio.addEventListener('ended',          onEnded)
    return () => {
      audio.removeEventListener('timeupdate',     onTime)
      audio.removeEventListener('durationchange', onDuration)
      audio.removeEventListener('play',           onPlay)
      audio.removeEventListener('pause',          onPause)
      audio.removeEventListener('ended',          onEnded)
    }
  }, [detail, logListen, advanceStory])

  // ── controls ───────────────────────────────────────────────────────────────

  function togglePlay() {
    const audio = audioRef.current
    if (!audio || !audio.src) return
    if (audio.paused) audio.play().catch(e => { if (e.name !== 'AbortError') console.error(e) })
    else audio.pause()
  }

  function seek(e) {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration
  }

  function skipNext() {
    advanceStory()
  }

  // ── derived display values ─────────────────────────────────────────────────

  const metaStory   = queue[currentIdx] || null
  const progress    = duration ? (currentTime / duration) * 100 : 0
  const totalInQueue = config.infinite ? '∞' : queue.length
  const position    = currentIdx + 1

  // Active paragraph for text display
  const activePara = detail?._voice
    ? null   // voice mode doesn't use para highlight here
    : detail?._paras?.[paraIdx] || null

  const coverImage = activePara?.images?.[0]?.image_url || metaStory?.cover_url || null

  // Para progress dots (paragraph mode)
  const totalParas  = detail?._paras?.length || 0
  const hasNoPara   = !loadingDetail && detail && !detail._voice && totalParas === 0

  // ── loading / error states ────────────────────────────────────────────────

  if (loadingQueue) return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="text-5xl">😔</span>
      <p className="text-stone-400">{error}</p>
      <button onClick={() => onEnd(0)} className="bg-stone-800 text-stone-300 font-bold px-6 py-3 rounded-2xl">Back</button>
    </div>
  )

  if (!metaStory) return null

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col">
      <audio ref={audioRef} />

      {/* Top bar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-stone-800/50">
        <button
          onClick={() => onEnd(countRef.current)}
          className="text-stone-600 hover:text-stone-400 transition text-sm"
        >
          ✕ Exit
        </button>
        <div className="flex flex-col items-center">
          <span className="text-xs text-stone-600 font-medium">Zen Mode</span>
          <span className="text-xs text-stone-500">{position} / {totalInQueue}</span>
        </div>
        <div className="text-sm text-stone-700 font-mono">{completedCount} listened</div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-md mx-auto w-full gap-6">

        {/* Cover art */}
        <div className="w-56 h-56 rounded-[2rem] overflow-hidden bg-stone-900 border border-stone-800 shadow-2xl flex-shrink-0 relative">
          {coverImage ? (
            <img key={coverImage} src={coverImage} className="w-full h-full object-cover animate-in fade-in duration-500" alt="" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">📖</div>
          )}
        </div>

        {/* Story info */}
        <div className="text-center w-full">
          <p className="text-xs text-emerald-500 font-bold uppercase tracking-widest mb-1">
            Level {metaStory.level} · {metaStory.category?.name}
          </p>
          <h2 className="text-2xl font-bold text-stone-100 leading-tight mb-1 line-clamp-2">{metaStory.title}</h2>
          <p className="text-sm text-stone-500 italic">{metaStory.author}</p>
        </div>

        {/* Loading detail spinner */}
        {loadingDetail && (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-stone-600" />
        )}

        {/* No audio warning */}
        {hasNoPara && (
          <p className="text-xs text-stone-600 text-center">This story has no audio. It will be skipped automatically.</p>
        )}

        {/* Auto-skip story with no audio */}
        {hasNoPara && !loadingDetail && (() => { setTimeout(advanceStory, 1500); return null })()}

        {/* Active paragraph text */}
        {activePara && (
          <div className="w-full bg-stone-900/80 rounded-2xl px-4 py-3 border border-stone-800 text-center">
            <p className="text-sm text-stone-400 leading-relaxed line-clamp-3 italic">"{activePara.content}"</p>
          </div>
        )}

        {/* Paragraph dots (progress within story) */}
        {totalParas > 1 && (
          <div className="flex gap-1.5 justify-center flex-wrap">
            {detail._paras.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
                i === paraIdx ? 'w-5 bg-emerald-500' : i < paraIdx ? 'w-1.5 bg-emerald-900' : 'w-1.5 bg-stone-700'
              }`} />
            ))}
          </div>
        )}

        {/* Progress bar */}
        <div className="w-full space-y-2">
          <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden cursor-pointer" onClick={seek}>
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-xs text-stone-600 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6">
          <button onClick={skipNext} className="w-12 h-12 flex items-center justify-center text-stone-500 hover:text-stone-300 transition-all" title="Skip story">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/>
            </svg>
          </button>

          <button
            onClick={togglePlay}
            disabled={loadingDetail || hasNoPara}
            className="w-16 h-16 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-40 rounded-full flex items-center justify-center transition-all shadow-2xl shadow-emerald-900/50"
          >
            {isPlaying ? (
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg className="w-7 h-7 text-white translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>

          <div className="w-12 h-12" />
        </div>

        {/* Queue preview */}
        {queue.length > 1 && (
          <div className="w-full">
            <p className="text-xs text-stone-700 uppercase tracking-widest font-bold mb-2 text-center">Up next</p>
            <div className="flex flex-col gap-1.5">
              {queue.slice(currentIdx + 1, currentIdx + 3).map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 bg-stone-900/50 rounded-xl px-3 py-2 border border-stone-800/50">
                  <span className="text-xs text-stone-700 font-mono w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-400 font-medium truncate">{s.title}</p>
                    <p className="text-xs text-stone-600">Level {s.level}</p>
                  </div>
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
function CompleteScreen({ completed, onRestart }) {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center px-6 text-center gap-8">
      <div className="w-24 h-24 rounded-3xl bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center text-5xl">
        🧘
      </div>
      <div>
        <h2 className="text-3xl font-bold mb-2">Session complete!</h2>
        <p className="text-stone-400 text-lg">
          You listened to <span className="text-emerald-400 font-bold">{completed}</span> {completed === 1 ? 'story' : 'stories'} in Zen mode.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={onRestart}
          className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-4 rounded-2xl transition-all"
        >
          New session
        </button>
        <Link
          to="/"
          className="w-full bg-stone-900 hover:bg-stone-800 text-stone-300 font-bold py-4 rounded-2xl transition-all text-center block"
        >
          Back to library
        </Link>
      </div>
    </div>
  )
}

// ── Root Component ────────────────────────────────────────────────────────────
export default function ZenModePage() {
  const [screen, setScreen]           = useState('setup')   // 'setup' | 'player' | 'complete'
  const [config, setConfig]           = useState(null)
  const [completedCount, setCompleted] = useState(0)

  function handleStart(cfg) {
    setConfig(cfg)
    setScreen('player')
  }

  function handleEnd(count) {
    setCompleted(count)
    setScreen('complete')
  }

  function handleRestart() {
    setConfig(null)
    setCompleted(0)
    setScreen('setup')
  }

  if (screen === 'setup')    return <SetupScreen onStart={handleStart} />
  if (screen === 'player')   return <PlayerScreen config={config} onEnd={handleEnd} />
  if (screen === 'complete') return <CompleteScreen completed={completedCount} onRestart={handleRestart} />
  return null
}

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00'
  const t = Math.floor(s)
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`
}
