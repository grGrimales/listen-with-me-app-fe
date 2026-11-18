import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getStory, getZenStories, logZenListen } from '../api/stories'
import { SetupScreen, CompleteScreen } from './ZenModePage'

// Read-along Zen: the same listening session as Zen Mode, laid out like a book page.
// The whole story is shown as text; the paragraph being spoken is in focus and, when
// the audio has word timestamps, each word lights up as it's said.

const PARA_GAP_MS  = 1500  // pause between paragraphs (screen on only, as in Zen Mode)
const STORY_GAP_MS = 3500  // pause between stories
const MANUAL_SCROLL_GRACE_MS = 4000  // don't auto-scroll right after the reader scrolls

const SERIF = "'Literata', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif"
const FONT_SIZES = [20, 23, 26, 30, 34, 38]
const PREFS_KEY = 'zenRead.prefs'
const DEFAULT_PREFS = { theme: 'night', size: 2, showEs: false }

// Low-glare palettes: warm off-black instead of pure black, ivory instead of pure white.
const THEMES = {
  night: {
    label: 'Night', swatch: '#17140f',
    vars: {
      '--bg': '#17140f', '--panel': 'rgba(33, 29, 23, 0.86)', '--line': 'rgba(236, 228, 211, 0.09)',
      '--text': '#ece4d3', '--soft': '#a39985', '--muted': '#7a7163',
      '--accent': '#7cc4a0', '--accent-ink': '#0f2219', '--mark': 'rgba(124, 196, 160, 0.22)',
    },
  },
  sepia: {
    label: 'Sepia', swatch: '#f3ead6',
    vars: {
      '--bg': '#f3ead6', '--panel': 'rgba(250, 244, 230, 0.88)', '--line': 'rgba(61, 48, 34, 0.11)',
      '--text': '#3a2e21', '--soft': '#86745c', '--muted': '#a08f76',
      '--accent': '#9a5b2a', '--accent-ink': '#fff8ee', '--mark': 'rgba(214, 160, 90, 0.32)',
    },
  },
  day: {
    label: 'Day', swatch: '#fafaf7',
    vars: {
      '--bg': '#fafaf7', '--panel': 'rgba(255, 255, 255, 0.88)', '--line': 'rgba(34, 32, 27, 0.09)',
      '--text': '#23211c', '--soft': '#86817a', '--muted': '#a7a298',
      '--accent': '#127a55', '--accent-ink': '#ffffff', '--mark': 'rgba(18, 122, 85, 0.15)',
    },
  },
}

function loadPrefs() {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') } }
  catch { return DEFAULT_PREFS }
}

function savePrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
}

function playSafely(audio) {
  audio.play().catch(e => { if (e.name !== 'AbortError') console.error(e) })
}

// Splits a paragraph into spans aligned with its word timestamps, keeping the original
// punctuation and spacing. Returns null when there are no usable timestamps.
function alignWords(text, words) {
  if (!words?.length) return null
  const parts = []
  const lower = text.toLowerCase()
  let from = 0
  for (const w of words) {
    const idx = lower.indexOf(w.word.toLowerCase(), from)
    if (idx < 0) continue // source and alignment disagree — skip this word
    if (idx > from) parts.push({ text: text.slice(from, idx) })
    parts.push({ text: text.slice(idx, idx + w.word.length), start: w.start_ms, end: w.end_ms })
    from = idx + w.word.length
  }
  if (from < text.length) parts.push({ text: text.slice(from) })
  return parts
}

function SpokenText({ text, words, ms }) {
  const parts = alignWords(text, words)
  if (!parts) return text
  return parts.map((p, i) => {
    if (p.start === undefined) return <span key={i}>{p.text}</span>
    const current = ms >= p.start && ms < p.end
    const upcoming = ms < p.start
    return (
      <span
        key={i}
        className="rounded-[0.22em] transition-[background-color,color] duration-200"
        style={{
          color: upcoming ? 'var(--soft)' : 'var(--text)',
          backgroundColor: current ? 'var(--mark)' : 'transparent',
          boxShadow: current ? '0 0 0 0.12em var(--mark)' : 'none',
        }}
      >
        {p.text}
      </span>
    )
  })
}

function IconButton({ onClick, title, children, disabled }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className="w-11 h-11 rounded-full flex items-center justify-center text-[var(--soft)] hover:text-[var(--text)] hover:bg-[var(--line)] disabled:opacity-30 transition"
    >
      {children}
    </button>
  )
}

// ── Reader / player ──────────────────────────────────────────────────────────
function ReadPlayer({ config, onEnd }) {
  const { token } = useAuth()
  const audioRef    = useRef(null)
  const prefetchRef = useRef(null)
  const preloadRef  = useRef(null)          // { id, full } of the next story
  const timerRef    = useRef(null)          // pending delayed play()
  const paraEls     = useRef(new Map())     // paragraph id -> DOM node
  const lastManualScroll = useRef(0)

  // Mirrors of the state read inside audio callbacks.
  const s = useRef({ queue: [], idx: 0, detail: null, paraIdx: 0, completed: 0, autoPlay: false, everPlayed: false, logged: new Set() })

  const [prefs, setPrefs]         = useState(loadPrefs)
  const [queue, setQueue]         = useState([])
  const [idx, setIdx]             = useState(0)
  const [turn, setTurn]           = useState(0)      // bumps on every story change
  const [detail, setDetail]       = useState(null)   // { story, voice, playable }
  const [paraIdx, setParaIdx]     = useState(0)      // index into detail.playable
  const [isPlaying, setIsPlaying] = useState(false)
  const [ms, setMs]               = useState(0)
  const [duration, setDuration]   = useState(0)
  const [completed, setCompleted] = useState(0)
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [loadingStory, setLoadingStory] = useState(false)
  const [error, setError]         = useState('')

  const theme = THEMES[prefs.theme] || THEMES.night
  const fontPx = FONT_SIZES[Math.min(Math.max(prefs.size, 0), FONT_SIZES.length - 1)]

  function updatePrefs(patch) {
    setPrefs(prev => {
      const next = { ...prev, ...patch }
      savePrefs(next)
      return next
    })
  }

  // ── playback primitives ────────────────────────────────────────────────────

  const startAudio = useCallback((delay = 0) => {
    const audio = audioRef.current
    clearTimeout(timerRef.current)
    // With the screen locked play at once: a silent gap lets mobile browsers suspend the page.
    if (delay && document.visibilityState !== 'hidden') {
      timerRef.current = setTimeout(() => playSafely(audio), delay)
    } else {
      playSafely(audio)
    }
  }, [])

  const loadPara = useCallback((i, { play = true, delay = 0 } = {}) => {
    const para = s.current.detail?.playable[i]
    if (!para) return
    s.current.paraIdx = i
    setParaIdx(i)
    setMs(0)
    const audio = audioRef.current
    audio.src = para.audio_url
    audio.load()
    if (play) startAudio(delay)
  }, [startAudio])

  const goToStory = useCallback((next, autoPlay) => {
    const st = s.current
    clearTimeout(timerRef.current)
    audioRef.current?.pause()
    if (next >= st.queue.length) {
      if (!config.infinite) { onEnd(st.completed); return }
      const reshuffled = [...st.queue].sort(() => Math.random() - 0.5)
      st.queue = reshuffled
      setQueue(reshuffled)
      next = 0
    }
    st.autoPlay = autoPlay
    st.idx = next
    setIdx(next)
    setTurn(t => t + 1)
  }, [config.infinite, onEnd])

  const finishStory = useCallback(() => {
    const st = s.current
    const story = st.queue[st.idx]
    if (story && !st.logged.has(story.id)) {
      st.logged.add(story.id)
      st.completed += 1
      setCompleted(st.completed)
      logZenListen(story.id, token).catch(e => console.error('zen listen log failed', e))
    }
    goToStory(st.idx + 1, true)
  }, [goToStory, token])

  // ── load queue ─────────────────────────────────────────────────────────────

  useEffect(() => {
    getZenStories(token, {
      playlistId: config.playlistId,
      limit: config.infinite ? 0 : config.count,
      sort: config.sort,
    })
      .then(stories => {
        if (!stories.length) { setError('No stories available with this configuration.'); return }
        s.current.queue = stories
        setQueue(stories)
        setTurn(1)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingQueue(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── load the current story ─────────────────────────────────────────────────

  useEffect(() => {
    if (!turn) return
    const story = s.current.queue[s.current.idx]
    if (!story) return
    let cancelled = false

    setLoadingStory(true)
    setDetail(null)
    s.current.detail = null

    const fetched = preloadRef.current?.id === story.id
      ? Promise.resolve(preloadRef.current.full)
      : getStory(story.id, token)

    fetched
      .then(full => {
        if (cancelled) return
        const voice = full.voices?.[0] || null
        const playable = voice ? [] : (full.paragraphs || []).filter(p => p.audio_url)
        const d = { story: full, voice, playable }
        s.current.detail = d
        setDetail(d)
        setDuration(0)
        window.scrollTo({ top: 0, behavior: 'smooth' })

        const autoPlay = s.current.autoPlay
        s.current.autoPlay = false
        if (voice) {
          s.current.paraIdx = 0
          setParaIdx(0)
          setMs(0)
          audioRef.current.src = voice.audio_url
          audioRef.current.load()
          if (autoPlay) startAudio(STORY_GAP_MS)
        } else if (playable.length) {
          loadPara(0, { play: autoPlay, delay: STORY_GAP_MS })
        }
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoadingStory(false) })

    return () => { cancelled = true }
  }, [turn, token, startAudio, loadPara])

  // Preload the next story's text and audio list.
  useEffect(() => {
    const next = queue[idx + 1]
    if (!next || preloadRef.current?.id === next.id) return
    getStory(next.id, token)
      .then(full => { preloadRef.current = { id: next.id, full } })
      .catch(console.error)
  }, [idx, queue, token])

  // Warm the next paragraph's audio so the swap is instant.
  useEffect(() => {
    const nextUrl = detail?.playable[paraIdx + 1]?.audio_url
    if (!nextUrl) return
    if (!prefetchRef.current) prefetchRef.current = new Audio()
    prefetchRef.current.preload = 'auto'
    prefetchRef.current.src = nextUrl
  }, [detail, paraIdx])

  // A story without audio can't be read along; move on.
  const noAudio = !loadingStory && detail && !detail.voice && detail.playable.length === 0
  useEffect(() => {
    if (!noAudio) return
    const t = setTimeout(() => goToStory(s.current.idx + 1, s.current.everPlayed), 2500)
    return () => clearTimeout(t)
  }, [noAudio, goToStory])

  // ── audio events ───────────────────────────────────────────────────────────

  useEffect(() => {
    const audio = audioRef.current
    const media = 'mediaSession' in navigator ? navigator.mediaSession : null

    const onPlay = () => {
      s.current.everPlayed = true
      setIsPlaying(true)
      if (media) media.playbackState = 'playing'
    }
    const onPause = () => {
      setIsPlaying(false)
      setMs(audio.currentTime * 1000)
      if (media) media.playbackState = 'paused'
    }
    const onSeeked   = () => setMs(audio.currentTime * 1000)
    const onDuration = () => setDuration(isFinite(audio.duration) ? audio.duration : 0)
    const onEnded    = () => {
      const st = s.current
      if (!st.detail) return
      if (!st.detail.voice && st.paraIdx + 1 < st.detail.playable.length) {
        loadPara(st.paraIdx + 1, { delay: PARA_GAP_MS })
      } else {
        finishStory()
      }
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('seeked', onSeeked)
    audio.addEventListener('durationchange', onDuration)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('seeked', onSeeked)
      audio.removeEventListener('durationchange', onDuration)
      audio.removeEventListener('ended', onEnded)
    }
  }, [loadPara, finishStory])

  // Smooth clock for the word highlight (timeupdate only fires ~4 times a second).
  useEffect(() => {
    if (!isPlaying) return
    let raf
    const tick = () => {
      setMs((audioRef.current?.currentTime || 0) * 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying])

  // Resume if the OS paused the audio when the screen was locked.
  useEffect(() => {
    let wasPlaying = false
    function onVisibility() {
      const audio = audioRef.current
      if (!audio) return
      if (document.visibilityState === 'hidden') wasPlaying = !audio.paused
      else if (wasPlaying && audio.paused && audio.src) playSafely(audio)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  // ── what is being read right now ───────────────────────────────────────────

  const paragraphs = detail?.story.paragraphs || []
  let activeId = null
  let activeWords = []
  if (detail?.voice) {
    const v = detail.voice
    const ts = v.timestamps?.find(t => ms >= t.start_ms && ms <= t.end_ms) || v.timestamps?.[0]
    activeId = ts?.paragraph_id ?? paragraphs[0]?.id ?? null
    activeWords = (v.word_timestamps || []).filter(w => w.paragraph_id === activeId)
  } else if (detail) {
    const para = detail.playable[paraIdx]
    activeId = para?.id ?? null
    activeWords = para?.word_timestamps || []
  }

  // ── controls ───────────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio?.src) return
    if (audio.paused) { clearTimeout(timerRef.current); playSafely(audio) }
    else { clearTimeout(timerRef.current); audio.pause() }
  }, [])

  const jumpToParagraph = useCallback((paragraphId) => {
    const d = s.current.detail
    if (!d) return
    lastManualScroll.current = 0
    if (d.voice) {
      const ts = d.voice.timestamps?.find(t => t.paragraph_id === paragraphId)
      if (!ts) return
      audioRef.current.currentTime = ts.start_ms / 1000
      setMs(ts.start_ms)
      playSafely(audioRef.current)
    } else {
      const i = d.playable.findIndex(p => p.id === paragraphId)
      if (i >= 0) loadPara(i)
    }
  }, [loadPara])

  const stepParagraph = useCallback((dir) => {
    const d = s.current.detail
    if (!d) return
    if (d.voice) {
      const list = d.voice.timestamps || []
      const cur = list.findIndex(t => t.paragraph_id === activeId)
      const target = list[Math.min(Math.max(cur + dir, 0), list.length - 1)]
      if (target) jumpToParagraph(target.paragraph_id)
      return
    }
    const i = s.current.paraIdx + dir
    if (i < 0) loadPara(0)
    else if (i >= d.playable.length) goToStory(s.current.idx + 1, true)
    else loadPara(i)
  }, [activeId, jumpToParagraph, loadPara, goToStory])

  const skipStory = useCallback(() => goToStory(s.current.idx + 1, true), [goToStory])

  // Keyboard: Space play/pause, ←/→ previous/next paragraph.
  useEffect(() => {
    function onKey(e) {
      if (e.target.closest?.('input, textarea, select')) return
      if (e.code === 'Space') { e.preventDefault(); togglePlay() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); stepParagraph(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stepParagraph(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, stepParagraph])

  // Keep the spoken paragraph in the middle of the screen, unless the reader just scrolled.
  useEffect(() => {
    const mark = () => { lastManualScroll.current = Date.now() }
    window.addEventListener('wheel', mark, { passive: true })
    window.addEventListener('touchmove', mark, { passive: true })
    return () => {
      window.removeEventListener('wheel', mark)
      window.removeEventListener('touchmove', mark)
    }
  }, [])

  useEffect(() => {
    if (!activeId) return
    if (Date.now() - lastManualScroll.current < MANUAL_SCROLL_GRACE_MS) return
    paraEls.current.get(activeId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeId])

  // ── lock screen / media keys ───────────────────────────────────────────────

  const metaStory = queue[idx] || null
  useEffect(() => {
    if (!('mediaSession' in navigator) || !metaStory) return
    const media = navigator.mediaSession
    media.metadata = new MediaMetadata({
      title: metaStory.title,
      artist: metaStory.author || 'Listen With Me',
      album: `Level ${metaStory.level} · ${metaStory.category?.name || 'Story'}`,
      artwork: [{ src: metaStory.cover_url || '/favicon.svg', sizes: '512x512', type: 'image/png' }],
    })
    media.setActionHandler('play', () => playSafely(audioRef.current))
    media.setActionHandler('pause', () => audioRef.current?.pause())
    media.setActionHandler('nexttrack', skipStory)
    media.setActionHandler('previoustrack', () => stepParagraph(-1))
    return () => {
      for (const action of ['play', 'pause', 'nexttrack', 'previoustrack']) media.setActionHandler(action, null)
    }
  }, [metaStory, skipStory, stepParagraph])

  // ── render ─────────────────────────────────────────────────────────────────

  const totalInQueue = config.infinite ? '∞' : queue.length
  const frac = duration ? Math.min(ms / 1000 / duration, 1) : 0
  const progress = detail?.voice
    ? frac
    : detail?.playable.length ? (paraIdx + frac) / detail.playable.length : 0

  const shell = (children) => (
    <div style={theme.vars} className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-500">
      <audio ref={audioRef} preload="auto" />
      {children}
    </div>
  )

  if (loadingQueue) return shell(
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-9 w-9 border-2 border-[var(--line)] border-t-[var(--accent)]" />
    </div>
  )

  if (error) return shell(
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-[var(--soft)]">{error}</p>
      <button onClick={() => onEnd(s.current.completed)} className="px-6 py-3 rounded-full border border-[var(--line)] text-[var(--text)] font-semibold">Back</button>
    </div>
  )

  return shell(
    <>
      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 z-20 backdrop-blur-md bg-[var(--panel)] border-b border-[var(--line)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button onClick={() => onEnd(s.current.completed)} className="text-sm font-medium text-[var(--soft)] hover:text-[var(--text)] transition">
            ✕ Exit
          </button>

          <p className="hidden sm:block text-xs text-[var(--muted)] tabular-nums">
            Story {idx + 1} / {totalInQueue} · {completed} listened
          </p>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center rounded-full border border-[var(--line)]">
              <button
                onClick={() => updatePrefs({ size: Math.max(prefs.size - 1, 0) })}
                disabled={prefs.size <= 0}
                title="Smaller text"
                className="w-9 h-8 text-xs font-semibold text-[var(--soft)] hover:text-[var(--text)] disabled:opacity-30 transition"
              >A</button>
              <button
                onClick={() => updatePrefs({ size: Math.min(prefs.size + 1, FONT_SIZES.length - 1) })}
                disabled={prefs.size >= FONT_SIZES.length - 1}
                title="Larger text"
                className="w-9 h-8 text-base font-semibold text-[var(--soft)] hover:text-[var(--text)] disabled:opacity-30 transition"
              >A</button>
            </div>

            <div className="flex items-center gap-1 px-1.5 h-8 rounded-full border border-[var(--line)]">
              {Object.entries(THEMES).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => updatePrefs({ theme: key })}
                  title={`${t.label} theme`}
                  className="w-5 h-5 rounded-full transition"
                  style={{
                    backgroundColor: t.swatch,
                    boxShadow: prefs.theme === key
                      ? '0 0 0 2px var(--bg), 0 0 0 3.5px var(--accent)'
                      : 'inset 0 0 0 1px rgba(128,128,128,0.45)',
                  }}
                />
              ))}
            </div>

            <button
              onClick={() => updatePrefs({ showEs: !prefs.showEs })}
              title="Show the Spanish translation of the paragraph being read"
              className={`h-8 px-3 rounded-full text-xs font-bold border transition ${
                prefs.showEs
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-ink)]'
                  : 'border-[var(--line)] text-[var(--soft)] hover:text-[var(--text)]'
              }`}
            >
              ES
            </button>
          </div>
        </div>
      </header>

      {/* Page */}
      <main className="max-w-[44rem] mx-auto px-6 sm:px-10 pt-28 pb-60" style={{ fontFamily: SERIF }}>
        {metaStory && (
          <div className="text-center mb-14 sm:mb-16">
            <p className="font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent)] mb-4">
              Level {metaStory.level}{metaStory.category?.name ? ` · ${metaStory.category.name}` : ''}
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold leading-tight text-[var(--text)]">{metaStory.title}</h1>
            {metaStory.author && <p className="mt-3 text-base italic text-[var(--muted)]">{metaStory.author}</p>}
            <div className="mx-auto mt-8 w-12 h-px bg-[var(--line)]" />
          </div>
        )}

        {loadingStory && (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-[var(--line)] border-t-[var(--accent)]" />
          </div>
        )}

        {noAudio && (
          <p className="font-sans text-sm text-center text-[var(--muted)] mb-10">
            This story has no audio yet, so it will be skipped.
          </p>
        )}

        <div className="flex flex-col" style={{ gap: '1.15em', fontSize: `min(${fontPx}px, calc(4.6vw + 6px))` }}>
          {paragraphs.map(p => {
            const active = p.id === activeId
            const translation = p.translations?.find(t => t.language === 'es')?.content
            return (
              <div
                key={p.id}
                ref={el => { if (el) paraEls.current.set(p.id, el); else paraEls.current.delete(p.id) }}
                onClick={() => { if (!window.getSelection()?.toString().trim()) jumpToParagraph(p.id) }}
                className={`cursor-pointer transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-35 hover:opacity-70'}`}
              >
                <p className="leading-[1.7] tracking-[0.005em]">
                  {active ? <SpokenText text={p.content} words={activeWords} ms={ms} /> : p.content}
                </p>
                {prefs.showEs && active && translation && (
                  <p className="font-sans mt-3 text-[0.62em] leading-relaxed italic text-[var(--soft)]">{translation}</p>
                )}
              </div>
            )
          })}
        </div>
      </main>

      {/* Player dock */}
      <div className="fixed bottom-0 inset-x-0 z-20 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pointer-events-none">
        <div className="pointer-events-auto mx-auto w-fit relative overflow-hidden rounded-full backdrop-blur-md bg-[var(--panel)] border border-[var(--line)] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)] px-3 py-2 flex items-center gap-1 sm:gap-2">
          <div className="absolute left-8 right-8 top-0 h-[2px] rounded-full bg-[var(--line)]">
            <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
          </div>

          <IconButton onClick={() => stepParagraph(-1)} title="Previous paragraph (←)" disabled={!detail || noAudio}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
          </IconButton>

          <button
            onClick={togglePlay}
            disabled={!detail || noAudio}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-110 active:scale-95 disabled:opacity-40 transition"
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg className="w-6 h-6 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>

          <IconButton onClick={() => stepParagraph(1)} title="Next paragraph (→)" disabled={!detail || noAudio}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </IconButton>

          <div className="w-px h-6 bg-[var(--line)] mx-1" />

          <IconButton onClick={skipStory} title="Next story">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </IconButton>
        </div>
        <p className="hidden sm:block text-center text-[11px] text-[var(--muted)] mt-2.5">
          Space play / pause · ← → paragraph · click a paragraph to jump to it
        </p>
      </div>
    </>
  )
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function ZenReadPage() {
  const [screen, setScreen]       = useState('setup')   // 'setup' | 'player' | 'complete'
  const [config, setConfig]       = useState(null)
  const [completed, setCompleted] = useState(0)

  if (screen === 'setup') {
    return (
      <SetupScreen
        mode="read"
        title="Read along"
        icon="📖"
        startLabel="📖 Start reading"
        onStart={cfg => { setConfig(cfg); setScreen('player') }}
      />
    )
  }
  if (screen === 'player') {
    return <ReadPlayer config={config} onEnd={n => { setCompleted(n); setScreen('complete') }} />
  }
  return (
    <CompleteScreen
      completed={completed}
      icon="📖"
      modeLabel="read-along mode"
      onRestart={() => { setConfig(null); setCompleted(0); setScreen('setup') }}
    />
  )
}
