import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getPhrasePlaylist, logPhraseReview, ratePhrase, setPhrasePlaylistFavorite, generatePollyAudio, addPhraseVocabulary, getPhraseVocabularyInfo } from '../api/phrases'
import PhrasePlaylistShareModal from '../components/PhrasePlaylistShareModal'

const LANG_LABELS = { en: 'English', pt: 'Português' }
const LANG_FLAGS  = { en: '🇺🇸', pt: '🇧🇷' }
const VOICE_NAMES = {
  en: { female: 'Joanna',  male: 'Matthew' },
  pt: { female: 'Camila',  male: 'Thiago'  },
}

const SORT_OPTIONS = [
  { value: 'playlist',       label: '📋 Playlist order' },
  { value: 'newest',         label: '🆕 Newest first' },
  { value: 'oldest',         label: '🕰️ Oldest first' },
  { value: 'least_reviewed', label: '📉 Least reviewed' },
  { value: 'random',         label: '🎲 Random' },
  { value: 'srs',            label: '🧠 Smart review (SRS)' },
]

const SESSION_SIZES = [5, 10, 20, 30, 0] // 0 = All

const DISPLAY_MODES = [
  { value: 'target',  label: '🌐 Target',  hint: 'Show phrase in target language' },
  { value: 'spanish', label: '🇪🇸 Spanish', hint: 'Show Spanish translation' },
  { value: 'audio',   label: '🔊 Audio only', hint: 'Just listen — no text' },
]

const RATINGS = [
  { quality: 0, label: 'Again', hotkey: '1', color: 'red',     hint: 'Reset — see soon' },
  { quality: 1, label: 'Hard',  hotkey: '2', color: 'orange',  hint: 'Slight delay' },
  { quality: 2, label: 'Good',  hotkey: '3', color: 'emerald', hint: 'Standard interval' },
  { quality: 3, label: 'Easy',  hotkey: '4', color: 'blue',    hint: 'Longer interval' },
]

const RATING_STYLES = {
  red:     'bg-red-500 hover:bg-red-600 border-red-500',
  orange:  'bg-orange-500 hover:bg-orange-600 border-orange-500',
  emerald: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-600',
  blue:    'bg-blue-500 hover:bg-blue-600 border-blue-500',
}

// Simple deterministic shuffle
function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function PhrasePlaylistDetailPage() {
  const { id } = useParams()
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [playlist, setPlaylist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState('playlist')
  const [sessionSize, setSessionSize] = useState(() => {
    try {
      const v = localStorage.getItem('phrase.sessionSize')
      return v ? Number(v) : 0 // 0 = all
    } catch { return 0 }
  })
  const [displayMode, setDisplayMode] = useState('audio')
  const [groupFilterId, setGroupFilterId] = useState(null)
  const [deck, setDeck] = useState([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [pollyPlaying, setPollyPlaying] = useState(null) // 'female' | 'male' | null
  const [pollyLoading, setPollyLoading] = useState(null) // 'female' | 'male' | null
  const [currentAudio, setCurrentAudio] = useState(null)
  const [sessionReviews, setSessionReviews] = useState(0)
  const [lastRatingResult, setLastRatingResult] = useState(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [selection, setSelection] = useState('') // currently highlighted text within target
  const [vocabCount, setVocabCount] = useState(0)
  const [vocabChildId, setVocabChildId] = useState(null)
  const [vocabWords, setVocabWords] = useState([])
  const [showVocabHighlights, setShowVocabHighlights] = useState(() => {
    try { return localStorage.getItem('phrase.showVocabHighlights') !== '0' } catch { return true }
  })
  const [vocabToast, setVocabToast] = useState(null) // {text, added: bool}
  const [addingVocab, setAddingVocab] = useState(false)

  const isSRS = sortBy === 'srs'

  useEffect(() => {
    setLoading(true)
    setError('')
    getPhrasePlaylist(id, token)
      .then(setPlaylist)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
    // Prefetch vocab info so the header badge/link and highlights are right
    getPhraseVocabularyInfo(id, token)
      .then(info => {
        setVocabCount(info.phrase_count || 0)
        setVocabChildId(info.child_playlist_id ?? null)
        setVocabWords(info.words || [])
      })
      .catch(() => { /* ignore, header just shows 0 */ })
  }, [id, token])

  useEffect(() => {
    try { localStorage.setItem('phrase.showVocabHighlights', showVocabHighlights ? '1' : '0') } catch { /* noop */ }
  }, [showVocabHighlights])

  // Build a flat list of all phrases (respecting group filter), then sort per selected mode.
  useEffect(() => {
    if (!playlist) return
    const groups = groupFilterId
      ? playlist.groups.filter(g => g.id === groupFilterId)
      : playlist.groups
    let flat = groups.flatMap(g =>
      g.phrases.map(p => ({ ...p, groupName: g.name, groupId: g.id }))
    )

    const now = Date.now()
    switch (sortBy) {
      case 'newest':
        flat.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        break
      case 'oldest':
        flat.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        break
      case 'least_reviewed':
        flat.sort((a, b) => a.review_count - b.review_count || new Date(a.created_at) - new Date(b.created_at))
        break
      case 'random':
        flat = shuffleArray(flat)
        break
      case 'srs': {
        // Due phrases: srs exists AND next_review_at <= now, ordered by next_review_at ASC
        // + New phrases: no srs row yet, ordered by created_at DESC
        // Not-yet-due phrases are excluded from the deck.
        const due = flat
          .filter(p => p.srs && new Date(p.srs.next_review_at).getTime() <= now)
          .sort((a, b) => new Date(a.srs.next_review_at) - new Date(b.srs.next_review_at))
        const fresh = flat
          .filter(p => !p.srs)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        flat = [...due, ...fresh]
        break
      }
      case 'playlist':
      default:
        // Already in group+position order from the API.
        break
    }
    if (sessionSize && sessionSize > 0) flat = flat.slice(0, sessionSize)
    setDeck(flat)
    // Depend on `playlist?.groups` (not `playlist`) so incidental playlist mutations —
    // toggling favorite, receiving updated metadata — don't reshuffle random/SRS decks.
  }, [playlist?.groups, groupFilterId, sortBy, sessionSize])

  // Reset position only when the filter, sort, or playlist itself changes —
  // not when we just cache an audio URL on the current playlist.
  useEffect(() => {
    setIndex(0)
    setRevealed(false)
    setLastRatingResult(null)
  }, [groupFilterId, sortBy, playlist?.id, sessionSize])

  useEffect(() => {
    try { localStorage.setItem('phrase.sessionSize', String(sessionSize)) } catch { /* noop */ }
  }, [sessionSize])

  const current = deck[index]
  const hasPrev = index > 0
  const hasNext = index < deck.length - 1

  // Detect text selection within the target-language text; only allow substrings of current.text.
  const captureSelection = useCallback(() => {
    if (!current) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) { setSelection(''); return }
    const text = sel.toString().trim()
    if (!text) { setSelection(''); return }
    if (!current.text.toLowerCase().includes(text.toLowerCase())) { setSelection(''); return }
    setSelection(text)
  }, [current])

  useEffect(() => { setSelection('') }, [index, groupFilterId, sortBy])

  // Build a memoized regex from vocab words (case-insensitive, longest first).
  // Uses Unicode word-boundary lookarounds so "table" doesn't match inside "comfortable",
  // while still working with accented letters (á, ã, ç…) in Portuguese/Spanish.
  const vocabRegex = useMemo(() => {
    if (!showVocabHighlights || vocabWords.length === 0) return null
    const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const sorted = [...vocabWords].sort((a, b) => b.text.length - a.text.length)
    const pattern = sorted.map(w => escape(w.text)).filter(Boolean).join('|')
    if (!pattern) return null
    // \p{L} = any Unicode letter, \p{N} = any Unicode number. Requires /u flag.
    return new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])`, 'giu')
  }, [showVocabHighlights, vocabWords])

  // Render text with saved-vocab matches wrapped in clickable highlighted spans.
  function renderWithHighlights(text) {
    if (!vocabRegex) return text
    const parts = []
    let lastIndex = 0
    let m
    vocabRegex.lastIndex = 0
    while ((m = vocabRegex.exec(text)) !== null) {
      if (m.index > lastIndex) parts.push({ t: text.slice(lastIndex, m.index), h: false })
      const matched = m[0]
      const word = vocabWords.find(w => w.text.toLowerCase() === matched.toLowerCase())
      parts.push({ t: matched, h: true, word })
      lastIndex = vocabRegex.lastIndex
      if (m.index === vocabRegex.lastIndex) vocabRegex.lastIndex++ // guard against zero-length matches
    }
    if (lastIndex < text.length) parts.push({ t: text.slice(lastIndex), h: false })
    return parts.map((p, i) =>
      p.h ? (
        <button
          key={i}
          onClick={e => { e.stopPropagation(); playVocabWord(p.word) }}
          title="Click to hear · saved in your vocab"
          className="bg-amber-200/70 hover:bg-amber-300 text-stone-800 rounded px-1 py-0 transition cursor-pointer inline"
        >
          {p.t}
        </button>
      ) : (
        <span key={i}>{p.t}</span>
      )
    )
  }

  async function handleAddVocab() {
    if (!selection || !current || addingVocab) return
    setAddingVocab(true)
    try {
      const res = await addPhraseVocabulary(playlist.id, selection, current.id, token)
      setVocabChildId(res.child_playlist_id)
      if (res.phrase_created) {
        setVocabCount(n => n + 1)
        setVocabWords(prev => [...prev, {
          id: res.phrase_id, text: selection,
          polly_audio_url_female: '', polly_audio_url_male: '',
        }])
      }
      setVocabToast({ text: selection, added: res.phrase_created })
      setTimeout(() => setVocabToast(null), 2000)
      setSelection('')
      window.getSelection()?.removeAllRanges()
    } catch (err) {
      alert(err.message)
    } finally {
      setAddingVocab(false)
    }
  }

  const goPrev = useCallback(() => {
    if (!hasPrev) return
    setIndex(i => i - 1)
    setRevealed(false)
    setLastRatingResult(null)
  }, [hasPrev])

  const isLast = deck.length > 0 && index === deck.length - 1

  const goNext = useCallback(() => {
    if (!current) return
    logPhraseReview(current.id, token)
      .then(() => setSessionReviews(n => n + 1))
      .catch(err => console.error('logPhraseReview:', err))
    if (isLast) {
      navigate('/phrases')
      return
    }
    setIndex(i => i + 1)
    setRevealed(false)
    setLastRatingResult(null)
  }, [isLast, current, token, navigate])

  // SRS rating: also handles Again (push phrase back to end of local queue)
  const rate = useCallback(async (quality) => {
    if (!current) return
    try {
      const result = await ratePhrase(current.id, quality, token)
      setSessionReviews(n => n + 1)
      setLastRatingResult({ quality, ...result })
      if (quality === 0) {
        // Push current phrase to the end of the deck so we see it again this session
        setDeck(prev => {
          const clone = [...prev]
          const [item] = clone.splice(index, 1)
          clone.push({ ...item, srs: { ...(item.srs || {}), ...result } })
          return clone
        })
        setRevealed(false)
        return
      }
      // Otherwise remove from current deck (or advance)
      setDeck(prev => {
        const clone = [...prev]
        clone.splice(index, 1)
        return clone
      })
      setRevealed(false)
    } catch (err) {
      alert(err.message)
    }
  }, [current, index, token])

  // Stop any in-flight audio when phrase / filter / sort changes or the page unmounts
  const segStopRef = useRef(null)
  const stopAudio = useCallback(() => {
    if (segStopRef.current) { cancelAnimationFrame(segStopRef.current); segStopRef.current = null }
    setCurrentAudio(prev => {
      if (prev) { try { prev.pause() } catch { /* noop */ } }
      return null
    })
    setPollyPlaying(null)
  }, [])
  useEffect(() => { return stopAudio }, [stopAudio])
  useEffect(() => { stopAudio() }, [index, groupFilterId, sortBy, stopAudio])

  const playPollyVoice = useCallback(async (gender) => {
    if (!current) return
    stopAudio()
    const cached = gender === 'male' ? current.polly_audio_url_male : current.polly_audio_url_female

    const playURL = (url) => {
      const audio = new Audio(url)
      setCurrentAudio(audio)
      audio.onplay = () => setPollyPlaying(gender)
      audio.onended = () => { setPollyPlaying(null); setCurrentAudio(null) }
      audio.onerror = () => { setPollyPlaying(null); setCurrentAudio(null) }
      audio.play().catch(err => {
        // AbortError is expected when we intentionally interrupt with pause() — ignore it.
        if (err && err.name !== 'AbortError') console.error('Polly playback:', err)
        setPollyPlaying(null)
        setCurrentAudio(null)
      })
    }

    if (cached) { playURL(cached); return }

    setPollyLoading(gender)
    try {
      const { audio_url } = await generatePollyAudio(current.id, gender, token)
      // Update the current phrase's URL directly on the deck. We deliberately don't
      // touch `playlist` state — mutating it would trigger a deck rebuild that reshuffles
      // random/SRS orderings, making the "next" phrase appear.
      setDeck(prev => prev.map(p => p.id === current.id
        ? { ...p, ...(gender === 'male' ? { polly_audio_url_male: audio_url } : { polly_audio_url_female: audio_url }) }
        : p))
      playURL(audio_url)
    } catch (err) {
      alert(`Polly audio failed: ${err.message}`)
    } finally {
      setPollyLoading(null)
    }
  }, [current, token, stopAudio])

  // Play the story-audio segment for a story-linked phrase: reuses the story's own
  // audio, playing only [source_start_ms, source_end_ms]. Stops precisely via rAF.
  const playStorySegment = useCallback(() => {
    if (!current || !current.source_audio_url) return
    stopAudio()
    const audio = new Audio(current.source_audio_url)
    const startSec = (current.source_start_ms || 0) / 1000
    const endSec = (current.source_end_ms || 0) / 1000
    setCurrentAudio(audio)

    const tick = () => {
      if (audio.paused) { segStopRef.current = null; return }
      if (endSec > 0 && audio.currentTime >= endSec) {
        audio.pause()
        setPollyPlaying(null)
        setCurrentAudio(null)
        segStopRef.current = null
        return
      }
      segStopRef.current = requestAnimationFrame(tick)
    }

    const startAndBound = () => {
      try { audio.currentTime = startSec } catch { /* ignore */ }
      audio.play().then(() => {
        setPollyPlaying('story')
        segStopRef.current = requestAnimationFrame(tick)
      }).catch(err => {
        if (err && err.name !== 'AbortError') console.error('Story segment playback:', err)
        setPollyPlaying(null)
        setCurrentAudio(null)
      })
    }

    audio.onended = () => { setPollyPlaying(null); setCurrentAudio(null) }
    audio.onerror = () => { setPollyPlaying(null); setCurrentAudio(null) }
    if (audio.readyState >= 1) startAndBound()
    else audio.addEventListener('loadedmetadata', startAndBound, { once: true })
  }, [current, stopAudio])

  // Play a saved vocab word's audio. Doesn't log a review — pure playback.
  const playVocabWord = useCallback(async (word, gender = 'female') => {
    if (!word) return
    stopAudio()
    const cached = gender === 'male' ? word.polly_audio_url_male : word.polly_audio_url_female
    const playURL = (url) => {
      const audio = new Audio(url)
      setCurrentAudio(audio)
      audio.play().catch(err => { if (err && err.name !== 'AbortError') console.error('Vocab playback:', err) })
    }
    if (cached) { playURL(cached); return }
    try {
      const { audio_url } = await generatePollyAudio(word.id, gender, token)
      setVocabWords(prev => prev.map(w => w.id === word.id
        ? { ...w, ...(gender === 'male' ? { polly_audio_url_male: audio_url } : { polly_audio_url_female: audio_url }) }
        : w))
      playURL(audio_url)
    } catch (err) {
      console.error('Vocab audio failed:', err)
    }
  }, [token, stopAudio])

  // Reset reveal when display mode changes so the challenge stays valid
  useEffect(() => { setRevealed(false) }, [displayMode])

  useEffect(() => {
    function onKey(e) {
      if (isSRS) {
        if (e.key >= '1' && e.key <= '4') {
          const q = parseInt(e.key, 10) - 1
          rate(q)
          return
        }
      } else {
        if (e.key === 'ArrowRight') goNext()
        else if (e.key === 'ArrowLeft') goPrev()
      }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setRevealed(r => !r) }
      else if (current?.source_audio_url) {
        // Story-linked phrase: F/M/P all play the single story-audio segment (no Polly).
        if (['f', 'm', 'p'].includes(e.key.toLowerCase())) playStorySegment()
      }
      else if (e.key.toLowerCase() === 'f' && current) { playPollyVoice('female') }
      else if (e.key.toLowerCase() === 'm' && current) { playPollyVoice('male') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev, rate, playPollyVoice, playStorySegment, current, isSRS])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  async function handleToggleFavorite() {
    if (!playlist) return
    const next = !playlist.is_favorite
    setPlaylist(prev => ({ ...prev, is_favorite: next }))
    try {
      await setPhrasePlaylistFavorite(playlist.id, next, token)
    } catch (err) {
      setPlaylist(prev => ({ ...prev, is_favorite: !next }))
      alert(err.message)
    }
  }

  // SRS caught-up state: playlist has phrases but none are due
  const srsCaughtUp = useMemo(() => {
    if (!isSRS || !playlist) return null
    const groups = groupFilterId ? playlist.groups.filter(g => g.id === groupFilterId) : playlist.groups
    const all = groups.flatMap(g => g.phrases)
    if (all.length === 0) return null
    if (deck.length > 0) return null
    // Next due, if any
    const nextDue = all
      .filter(p => p.srs)
      .map(p => new Date(p.srs.next_review_at).getTime())
      .sort((a, b) => a - b)[0]
    return { nextDueAt: nextDue ? new Date(nextDue) : null }
  }, [isSRS, playlist, groupFilterId, deck.length])

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

      <main
        className="flex-1 max-w-3xl w-full mx-auto p-6 flex flex-col"
        onMouseUp={captureSelection}
        onTouchEnd={captureSelection}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-4"></div>
            <p>Loading playlist...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center">{error}</div>
        ) : !playlist ? null : (
          <>
            {/* Playlist header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="text-3xl">{LANG_FLAGS[playlist.language] || '🌐'}</span>
                <span className="bg-stone-100 text-stone-500 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                  {LANG_LABELS[playlist.language] || playlist.language}
                </span>
                {playlist.role && playlist.role !== 'owner' && (
                  <span className="bg-sky-100 text-sky-700 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                    🤝 {playlist.role === 'editor' ? 'Editor' : 'Shared'}
                  </span>
                )}
                {playlist.parent_playlist_id && (
                  <Link
                    to={`/phrases/${playlist.parent_playlist_id}`}
                    className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded flex items-center gap-1 transition"
                    title="Back to parent playlist"
                  >
                    📗 Vocab of: {playlist.parent_playlist_name}
                  </Link>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {playlist.parent_playlist_id ? null : (
                    vocabChildId ? (
                      <Link
                        to={`/phrases/${vocabChildId}`}
                        title="Open my vocabulary playlist"
                        className="text-xs font-bold text-stone-500 hover:text-emerald-700 border border-stone-200 hover:border-emerald-400 rounded-lg px-3 py-1.5 transition flex items-center gap-1"
                      >
                        📗 Vocab
                        {vocabCount > 0 && (
                          <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 rounded">{vocabCount}</span>
                        )}
                      </Link>
                    ) : (
                      <span
                        title="Highlight a word in the target text to add it here"
                        className="text-xs font-bold text-stone-300 border border-stone-200 rounded-lg px-3 py-1.5 flex items-center gap-1 cursor-not-allowed"
                      >
                        📗 Vocab
                      </span>
                    )
                  )}
                  {(playlist.role === 'owner' || playlist.role === 'editor') && (
                    <Link
                      to={`/phrases/${playlist.id}/manage`}
                      title="Edit phrases and groups"
                      className="text-xs font-bold text-stone-500 hover:text-emerald-700 border border-stone-200 hover:border-emerald-400 rounded-lg px-3 py-1.5 transition"
                    >
                      ✏️ Manage
                    </Link>
                  )}
                  {playlist.role === 'owner' && (
                    <>
                      <button
                        onClick={() => setShowShareModal(true)}
                        title="Share playlist"
                        className="text-stone-400 hover:text-emerald-600 transition"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </button>
                      <button
                        onClick={handleToggleFavorite}
                        title={playlist.is_favorite ? 'Remove from favorites' : 'Mark as favorite'}
                        className="transition-transform active:scale-110"
                      >
                        {playlist.is_favorite
                          ? <svg className="w-6 h-6 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                          : <svg className="w-6 h-6 text-stone-300 hover:text-amber-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <h2 className="text-2xl font-bold text-stone-800 tracking-tight">{playlist.name}</h2>
              {playlist.description && <p className="text-sm text-stone-500 mt-0.5">{playlist.description}</p>}
            </div>

            {showShareModal && (
              <PhrasePlaylistShareModal playlist={playlist} onClose={() => setShowShareModal(false)} />
            )}

            {/* Sort + group filters */}
            <div className="mb-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-stone-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-700 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all cursor-pointer"
                >
                  {SORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
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
              {isSRS && (
                <span className="text-[11px] text-stone-400 italic">
                  Only phrases due for review are shown. Rate to schedule the next appearance.
                </span>
              )}
            </div>

            {/* Display mode chips */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-stone-400 font-semibold uppercase tracking-wider mr-1">Show:</span>
              {DISPLAY_MODES.map(m => (
                <button
                  key={m.value}
                  onClick={() => setDisplayMode(m.value)}
                  title={m.hint}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${displayMode === m.value ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-stone-500 border-stone-200 hover:border-emerald-400 hover:text-emerald-700'}`}
                >
                  {m.label}
                </button>
              ))}
              {vocabWords.length > 0 && (
                <button
                  onClick={() => setShowVocabHighlights(v => !v)}
                  title="Toggle highlighting for words you've saved to your vocab"
                  className={`ml-auto px-3 py-1.5 rounded-full text-xs font-bold border transition flex items-center gap-1.5 ${showVocabHighlights ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-white text-stone-400 border-stone-200 hover:border-amber-300'}`}
                >
                  <span className="text-sm leading-none">{showVocabHighlights ? '✨' : '☐'}</span>
                  Highlight vocab ({vocabWords.length})
                </button>
              )}
            </div>

            {playlist.groups.length > 1 && (
              <div className="mb-6 flex flex-wrap gap-2">
                <button
                  onClick={() => setGroupFilterId(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${!groupFilterId ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'}`}
                >
                  All groups
                </button>
                {playlist.groups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setGroupFilterId(g.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${groupFilterId === g.id ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'}`}
                  >
                    {g.name} <span className="opacity-60">({g.phrases.length})</span>
                  </button>
                ))}
              </div>
            )}

            {/* SRS "caught up" empty state */}
            {srsCaughtUp ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                <span className="text-5xl mb-4 block">✅</span>
                <h3 className="text-xl font-bold text-stone-800 mb-2">All caught up!</h3>
                <p className="text-stone-500 mb-2">Nothing due for review right now.</p>
                {srsCaughtUp.nextDueAt && (
                  <p className="text-xs text-stone-400">
                    Next review: {srsCaughtUp.nextDueAt.toLocaleString()}
                  </p>
                )}
              </div>
            ) : deck.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                <span className="text-5xl mb-4 block">📭</span>
                <p className="text-stone-500">No phrases to review here yet.</p>
              </div>
            ) : (
              <>
                {/* Progress */}
                <div className="mb-4 flex items-center justify-between text-xs text-stone-400">
                  <span className="font-semibold uppercase tracking-wider">{current.groupName}</span>
                  <div className="flex items-center gap-3">
                    {sessionReviews > 0 && (
                      <span className="font-bold text-emerald-600">✓ {sessionReviews} reviewed</span>
                    )}
                    <span className="font-bold">{index + 1} / {deck.length}</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-stone-200 rounded-full mb-6 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${((index + 1) / deck.length) * 100}%` }}
                  />
                </div>

                {/* Flashcard */}
                <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-8 sm:p-12 mb-6 min-h-[280px] flex flex-col items-center justify-center text-center">
                  {/* Front: depends on displayMode */}
                  {displayMode === 'target' && (
                    <p className="text-3xl sm:text-4xl font-bold text-stone-800 leading-tight mb-6">
                      {renderWithHighlights(current.text)}
                    </p>
                  )}
                  {displayMode === 'spanish' && (
                    <p className="text-3xl sm:text-4xl font-bold text-emerald-700 leading-tight mb-6">
                      {current.translation_es}
                    </p>
                  )}
                  {displayMode === 'audio' && (
                    <div className="mb-6 flex flex-col items-center">
                      <p className="text-6xl font-bold text-stone-200 leading-none mb-2 select-none">···</p>
                      <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold">Listen and guess</p>
                    </div>
                  )}

                  {/* Story-linked phrase: single audio = the story's own narration segment */}
                  {current.source_audio_url ? (
                    <div className="flex flex-col items-center gap-1 mb-6">
                      <button
                        onClick={playStorySegment}
                        title="Play the story audio"
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-sm border-2 active:scale-95 ${pollyPlaying === 'story' ? 'bg-emerald-600 border-emerald-600 text-white animate-pulse' : 'bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400'}`}
                      >
                        <span className="text-2xl">🎧</span>
                      </button>
                      <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Story audio</span>
                    </div>
                  ) : (
                  /* Two Polly voices — female + male — with per-language voice names */
                  <div className="flex items-center gap-6 mb-6">
                    {['female', 'male'].map(gender => {
                      const cached = gender === 'male' ? current.polly_audio_url_male : current.polly_audio_url_female
                      const loading = pollyLoading === gender
                      const playing = pollyPlaying === gender
                      const voiceName = VOICE_NAMES[playlist.language]?.[gender] || (gender === 'male' ? 'Male' : 'Female')
                      const emoji = gender === 'male' ? '👨' : '👩'
                      const activeStyle = gender === 'male'
                        ? 'bg-sky-600 border-sky-600'
                        : 'bg-pink-500 border-pink-500'
                      const idleStyle = gender === 'male'
                        ? 'bg-white border-sky-200 text-sky-600 hover:bg-sky-50 hover:border-sky-400'
                        : 'bg-white border-pink-200 text-pink-600 hover:bg-pink-50 hover:border-pink-400'
                      return (
                        <div key={gender} className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => playPollyVoice(gender)}
                            disabled={loading}
                            title={`${voiceName} — ${gender === 'male' ? 'M' : 'F'} key`}
                            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-sm border-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 ${playing ? `${activeStyle} text-white animate-pulse` : idleStyle}`}
                          >
                            {loading ? (
                              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                                <path className="opacity-90" d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                              </svg>
                            ) : (
                              <span className="text-2xl">{emoji}</span>
                            )}
                          </button>
                          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1">
                            {voiceName}
                            {cached && <span className="text-emerald-500" title="Cached">●</span>}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  )}

                  {/* Back: reveal the pieces NOT shown on the front */}
                  {revealed ? (
                    <div className="w-full border-t border-stone-100 pt-5 mt-1 space-y-2">
                      {displayMode !== 'target' && (
                        <p className="text-xl sm:text-2xl text-stone-800 font-bold">{renderWithHighlights(current.text)}</p>
                      )}
                      {displayMode !== 'spanish' && (
                        <p className={`${displayMode === 'audio' ? 'text-lg text-emerald-700' : 'text-xl sm:text-2xl text-emerald-700'} font-semibold`}>
                          {current.translation_es}
                        </p>
                      )}
                      {current.pronunciation_es && (
                        <p className="text-sm text-stone-400 italic">
                          <span className="font-mono">{current.pronunciation_es}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setRevealed(true)}
                      className="text-sm font-bold text-emerald-600 border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 rounded-xl px-5 py-2.5 transition"
                    >
                      Show answer
                    </button>
                  )}

                  {isSRS && current.srs && (
                    <p className="text-[11px] text-stone-400 mt-4">
                      Reps: {current.srs.repetitions} · Ease: {current.srs.ease_factor.toFixed(2)} · Lapses: {current.srs.lapses}
                    </p>
                  )}
                </div>

                {/* Controls */}
                {isSRS ? (
                  <>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {RATINGS.map(r => (
                        <button
                          key={r.quality}
                          onClick={() => rate(r.quality)}
                          disabled={!revealed}
                          title={`${r.hint} (${r.hotkey})`}
                          className={`flex flex-col items-center justify-center gap-0.5 text-white font-bold py-3 rounded-2xl transition-all shadow-sm border-2 ${RATING_STYLES[r.color]} disabled:opacity-30 disabled:cursor-not-allowed`}
                        >
                          <span className="text-sm">{r.label}</span>
                          <span className="text-[10px] opacity-80 font-mono">[{r.hotkey}]</span>
                        </button>
                      ))}
                    </div>
                    {!revealed && (
                      <p className="text-[11px] text-stone-400 text-center mb-3">Reveal the answer first, then rate how well you remembered.</p>
                    )}
                    {lastRatingResult && (
                      <p className="text-xs text-stone-500 text-center mb-3">
                        Last rating: <span className="font-bold">{RATINGS[lastRatingResult.quality].label}</span> — next review in <span className="font-bold">{formatInterval(lastRatingResult.interval_days)}</span>
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={goPrev}
                      disabled={!hasPrev}
                      className="flex items-center gap-2 bg-white border border-stone-200 text-stone-700 font-bold px-5 py-3 rounded-2xl transition hover:border-stone-400 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                      </svg>
                      Prev
                    </button>
                    <button
                      onClick={() => setRevealed(r => !r)}
                      className="text-xs text-stone-400 hover:text-stone-700 font-semibold transition"
                    >
                      {revealed ? 'Hide' : 'Show'} answer
                    </button>
                    <button
                      onClick={goNext}
                      disabled={!current}
                      className={`flex items-center gap-2 text-white font-bold px-5 py-3 rounded-2xl transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${isLast ? 'bg-stone-800 hover:bg-stone-700 shadow-stone-900/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'}`}
                    >
                      {isLast ? 'Finalizar' : 'Next'}
                      {isLast ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}

                <p className="text-[11px] text-stone-300 text-center mt-4">
                  {isSRS
                    ? 'Tip: reveal · 1=Again · 2=Hard · 3=Good · 4=Easy · F=female voice · M=male voice'
                    : 'Tip: ← → navigate · space to reveal · F=female voice · M=male voice'}
                </p>
              </>
            )}
          </>
        )}
      </main>

      {/* Floating "add to vocabulary" pill — appears when user highlights text within the target */}
      {selection && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={handleAddVocab}
            disabled={addingVocab}
            className="flex items-center gap-2 bg-stone-900 hover:bg-emerald-700 text-white font-bold px-4 py-3 rounded-full shadow-2xl transition disabled:opacity-60"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm">
              Add <span className="bg-emerald-500/30 px-1.5 py-0.5 rounded font-mono">{selection.length > 30 ? selection.slice(0, 30) + '…' : selection}</span> to vocab
            </span>
          </button>
        </div>
      )}

      {/* Toast after adding */}
      {vocabToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-bold px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom">
          ✅ Added "<span className="font-mono">{vocabToast.text.length > 40 ? vocabToast.text.slice(0, 40) + '…' : vocabToast.text}</span>"
        </div>
      )}
    </div>
  )
}

function formatInterval(days) {
  if (days == null) return ''
  if (days < 1) return 'today'
  if (days < 30) return `${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`
  if (days < 365) return `${Math.round(days / 30)} mo`
  return `${Math.round(days / 365)} yr`
}
