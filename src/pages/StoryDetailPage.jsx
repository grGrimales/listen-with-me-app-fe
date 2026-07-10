import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getStory, markStoryAsReviewed, getUserVocabulary, addUserVocabulary, deleteUserVocabulary, reorderUserVocabulary, updateUserLanguage } from '../api/stories'

// ── Theme definitions ────────────────────────────────────────────────────────
const T = {
  light: {
    page:             'bg-stone-50',
    nav:              'bg-white border-stone-200',
    navLink:          'text-stone-500 hover:text-stone-800',
    navTitle:         'text-stone-800',
    hero:             'bg-white border-stone-200',
    heroTitle:        'text-stone-900',
    heroSub:          'text-stone-500',
    paraNumIdle:      'text-stone-300',
    paraNumActive:    'text-emerald-500',
    paraText:         'text-stone-800',
    paraTextActive:   'text-emerald-900',
    paraActive:       'bg-emerald-50/50 ring-1 ring-emerald-100 shadow-sm',
    transCard:        'bg-stone-50 border-stone-200/60',
    transCardActive:  'bg-white border-emerald-100 shadow-sm',
    transLabel:       'text-stone-300',
    transLabelActive: 'text-emerald-400',
    transText:        'text-stone-600',
    vocabChip:        'bg-white border-stone-200 text-stone-600',
    divider:          'border-stone-200',
    endText:          'text-stone-400',
    playBtn:          'bg-stone-100 text-stone-500 hover:bg-emerald-100 hover:text-emerald-600',
    settingsPanel:    'bg-white border-stone-200 shadow-xl',
    settingsLabel:    'text-stone-400',
    chip:             'bg-white text-stone-500 border-stone-200 hover:border-stone-300',
    chipActive:       'bg-emerald-600 text-white border-emerald-600',
  },
  sepia: {
    page:             'bg-[#f5ead7]',
    nav:              'bg-[#f0e0c0] border-[#d9c9a8]',
    navLink:          'text-amber-700 hover:text-amber-900',
    navTitle:         'text-amber-900',
    hero:             'bg-[#f0e0c0] border-[#d9c9a8]',
    heroTitle:        'text-amber-950',
    heroSub:          'text-amber-700',
    paraNumIdle:      'text-amber-300',
    paraNumActive:    'text-emerald-600',
    paraText:         'text-amber-950',
    paraTextActive:   'text-emerald-900',
    paraActive:       'bg-emerald-50/40 ring-1 ring-emerald-200 shadow-sm',
    transCard:        'bg-[#ecdfc6] border-[#d9c9a8]',
    transCardActive:  'bg-[#f0e0c0] border-emerald-200 shadow-sm',
    transLabel:       'text-amber-400',
    transLabelActive: 'text-emerald-500',
    transText:        'text-amber-800',
    vocabChip:        'bg-[#f0e0c0] border-[#d9c9a8] text-amber-800',
    divider:          'border-[#d9c9a8]',
    endText:          'text-amber-600',
    playBtn:          'bg-amber-200 text-amber-600 hover:bg-emerald-100 hover:text-emerald-600',
    settingsPanel:    'bg-[#f0e0c0] border-[#d9c9a8] shadow-xl',
    settingsLabel:    'text-amber-500',
    chip:             'bg-[#f0e0c0] text-amber-700 border-[#d9c9a8] hover:border-amber-400',
    chipActive:       'bg-emerald-600 text-white border-emerald-600',
  },
  night: {
    page:             'bg-stone-950',
    nav:              'bg-stone-950 border-stone-800',
    navLink:          'text-stone-400 hover:text-stone-100',
    navTitle:         'text-stone-100',
    hero:             'bg-stone-950 border-stone-800',
    heroTitle:        'text-stone-50',
    heroSub:          'text-stone-400',
    paraNumIdle:      'text-stone-700',
    paraNumActive:    'text-emerald-400',
    paraText:         'text-stone-200',
    paraTextActive:   'text-emerald-300',
    paraActive:       'bg-emerald-950/50 ring-1 ring-emerald-900',
    transCard:        'bg-stone-900 border-stone-800',
    transCardActive:  'bg-stone-900 border-emerald-900 shadow-sm',
    transLabel:       'text-stone-600',
    transLabelActive: 'text-emerald-500',
    transText:        'text-stone-400',
    vocabChip:        'bg-stone-900 border-stone-700 text-stone-300',
    divider:          'border-stone-800',
    endText:          'text-stone-600',
    playBtn:          'bg-stone-800 text-stone-400 hover:bg-emerald-900/60 hover:text-emerald-400',
    settingsPanel:    'bg-stone-900 border-stone-700 shadow-2xl',
    settingsLabel:    'text-stone-500',
    chip:             'bg-stone-800 text-stone-300 border-stone-700 hover:border-stone-500',
    chipActive:       'bg-emerald-600 text-white border-emerald-600',
  },
}

const FONT_MIN = 14
const FONT_MAX = 34
const FONT_STEP = 2
const FONT_DEFAULT = 20

// ── Component ────────────────────────────────────────────────────────────────
export default function StoryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token, user, targetLanguage, setTargetLanguage } = useAuth()
  const [story, setStory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Reading preferences (persisted)
  const [showTranslation, setShowTranslation] = useState(false)
  const [showVocabulary, setShowVocabulary] = useState(false)
  const [showImages, setShowImages] = useState(() => localStorage.getItem('rwm_showImages') !== 'false')
  const [wordClickMode, setWordClickMode] = useState(() => localStorage.getItem('rwm_wordClickMode') === 'true')
  const [theme, setTheme] = useState(() => localStorage.getItem('rwm_theme') || 'light')
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('rwm_fontSize')) || FONT_DEFAULT)
  const [showSettings, setShowSettings] = useState(false)
  const [isSticky, setIsSticky] = useState(false)

  const controlsRef = useRef(null)

  useEffect(() => {
    const handleScroll = () => {
      if (controlsRef.current) {
        const rect = controlsRef.current.getBoundingClientRect()
        // We consider it "sticky" when it reaches the header (approx 69px)
        setIsSticky(rect.top <= 70)
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => { localStorage.setItem('rwm_theme', theme) }, [theme])
  useEffect(() => { localStorage.setItem('rwm_fontSize', fontSize) }, [fontSize])
  useEffect(() => { localStorage.setItem('rwm_showImages', showImages) }, [showImages])
  useEffect(() => { localStorage.setItem('rwm_wordClickMode', wordClickMode) }, [wordClickMode])

  // Voice-mode state
  const [currentVoice, setCurrentVoice] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [activeParagraphId, setActiveParagraphId] = useState(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)

  // User Vocabulary state
  const [userVocab, setUserVocab] = useState([])
  const [selectedText, setSelectedText] = useState('')
  const [selectionBox, setSelectionBox] = useState(null)

  // Tab state
  const [activeTab, setActiveTab] = useState('read')

  // Paragraph-mode state
  const [playingParaId, setPlayingParaId] = useState(null)
  const [paraIsPlaying, setParaIsPlaying] = useState(false)
  const [paraCurrentTime, setParaCurrentTime] = useState(0)
  const [paraDuration, setParaDuration] = useState(0)
  const [isLooping, setIsLooping] = useState(false)

  const audioRef = useRef(null)
  const settingsRef = useRef(null)
  const selectionTimerRef = useRef(null)
  const paraDelayRef = useRef(null)
  const paraRefs = useRef({})
  const vocabAudioRef = useRef(null)
  const vocabStopRef = useRef(null)

  const singlePlayRef = useRef(false)

  // Refs for audio event closures
  const playingParaIdRef = useRef(null)
  const isLoopingRef = useRef(false)
  const storyRef = useRef(null)
  const currentVoiceRef = useRef(null)
  const playParagraphRef = useRef(null)

  useEffect(() => { playingParaIdRef.current = playingParaId }, [playingParaId])
  useEffect(() => { isLoopingRef.current = isLooping }, [isLooping])
  useEffect(() => { storyRef.current = story }, [story])
  useEffect(() => { currentVoiceRef.current = currentVoice }, [currentVoice])

  useEffect(() => {
    setLoading(true)
    setError('')
    // Stop any playing audio when language changes
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    setPlayingParaId(null)
    setParaIsPlaying(false)
    setActiveParagraphId(null)
    setCurrentVoice(null)
    setIsPlaying(false)

    async function load() {
      try {
        const [storyData, vocabData] = await Promise.all([
          getStory(id, token, targetLanguage),
          getUserVocabulary(id, token).catch(() => [])
        ])
        setStory(storyData)
        setUserVocab(vocabData)
        if (storyData.voices?.length > 0) setCurrentVoice(storyData.voices[0])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, token, targetLanguage])

  async function handleLanguageChange(lang) {
    if (lang === targetLanguage) return
    try {
      await updateUserLanguage(lang, token)
      setTargetLanguage(lang)
      // Story reloads via the targetLanguage dependency in the effect above
    } catch (err) {
      console.error('Failed to update language:', err)
    }
  }

  // Handle text selection — works on both desktop (mouseup) and mobile (selectionchange)
  useEffect(() => {
    function handleSelectionUpdate() {
      clearTimeout(selectionTimerRef.current)
      selectionTimerRef.current = setTimeout(() => {
        const selection = window.getSelection()
        const text = selection?.toString().trim()

        if (text && text.length > 0) {
          try {
            const range = selection.getRangeAt(0)
            const rect = range.getBoundingClientRect()
            // Show below if selection is near top of viewport (avoids native mobile toolbar)
            const showBelow = rect.top < 80
            setSelectedText(text)
            setSelectionBox({
              top: showBelow ? rect.bottom + 10 : Math.max(10, rect.top - 52),
              left: Math.max(60, Math.min(rect.left + rect.width / 2, window.innerWidth - 60)),
              showBelow,
            })
          } catch {
            setSelectedText('')
            setSelectionBox(null)
          }
        } else {
          setSelectedText('')
          setSelectionBox(null)
        }
      }, 150)
    }

    document.addEventListener('mouseup', handleSelectionUpdate)
    document.addEventListener('selectionchange', handleSelectionUpdate)
    return () => {
      clearTimeout(selectionTimerRef.current)
      document.removeEventListener('mouseup', handleSelectionUpdate)
      document.removeEventListener('selectionchange', handleSelectionUpdate)
    }
  }, [])

  async function handleAddVocab() {
    if (!selectedText) return
    const textToSave = selectedText
    const tempId = Date.now() // Stable temp key
    try {
      const newItem = await addUserVocabulary(id, textToSave, token, targetLanguage)
      const vocabToAdd = {
        ...newItem,
        id: newItem.id || tempId, // Use real ID if available, else temp
        phrase: newItem.phrase || textToSave
      }
      setUserVocab(prev => [vocabToAdd, ...prev])
      setSelectedText('')
      setSelectionBox(null)
      window.getSelection().removeAllRanges()
      // Soft, non-blocking note when the word was added to word playlists but has no
      // story audio yet (the paragraph audio hasn't been generated).
      if (newItem.added_to_playlists > 0 && newItem.audio_missing) {
        alert('Guardado. Genera el audio de este párrafo para poder reproducir esta palabra en tus playlists de palabras.')
      }
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleDeleteVocab(vocabId) {
    try {
      await deleteUserVocabulary(vocabId, token)
      setUserVocab(prev => prev.filter(v => v.id !== vocabId))
    } catch (err) {
      alert("Error deleting vocabulary: " + err.message)
    }
  }

  function handleMoveVocab(vocabId, direction) {
    setUserVocab(prev => {
      const idx = prev.findIndex(v => v.id === vocabId)
      if (idx < 0) return prev
      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
      reorderUserVocabulary(id, next.map(v => v.id), token).catch(console.error)
      return next
    })
  }

  const LANG_SPEECH_CODE = { en: 'en-US', pt: 'pt-BR' }

  function speakFallback(text) {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = LANG_SPEECH_CODE[targetLanguage] || 'en-US'
    window.speechSynthesis.speak(utterance)
  }

  // Keep speak() for non-vocab uses (selection popup, etc.)
  function speak(text) { speakFallback(text) }

  // Locates a saved phrase inside the story's paragraphs using the per-word
  // timestamps, returning the paragraph and the [start, end] ms of the phrase.
  // Punctuation is ignored when matching. Returns null if not found.
  function findVocabSegment(phrase) {
    if (!story?.paragraphs) return null
    const norm = s => (s || '').toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')
    const tokens = phrase.trim().split(/\s+/).map(norm).filter(Boolean)
    if (tokens.length === 0) return null
    for (const p of story.paragraphs) {
      const words = p.word_timestamps
      if (!p.audio_url || !words?.length) continue
      for (let i = 0; i + tokens.length <= words.length; i++) {
        let ok = true
        for (let j = 0; j < tokens.length; j++) {
          if (norm(words[i + j].word) !== tokens[j]) { ok = false; break }
        }
        if (ok) return { para: p, startMs: words[i].start_ms, endMs: words[i + tokens.length - 1].end_ms }
      }
    }
    return null
  }

  function stopVocabSegment() {
    const a = vocabAudioRef.current
    if (a) a.pause()
    if (vocabStopRef.current) {
      cancelAnimationFrame(vocabStopRef.current)
      vocabStopRef.current = null
    }
  }

  // Plays only [startMs, endMs] of a paragraph's own audio, on a dedicated audio
  // element so it doesn't disturb the main narration player. Uses requestAnimationFrame
  // (~16ms precision) to stop right at endMs — timeupdate (~250ms) would bleed into
  // the next word.
  function playVocabSegment(para, startMs, endMs) {
    if (!vocabAudioRef.current) vocabAudioRef.current = new Audio()
    const a = vocabAudioRef.current
    // Avoid overlapping with the main narration.
    if (audioRef.current && !audioRef.current.paused) audioRef.current.pause()
    stopVocabSegment()

    const startAndBound = () => {
      try { a.currentTime = startMs / 1000 } catch { /* ignore */ }
      const endSec = endMs / 1000
      const tick = () => {
        if (a.paused) { vocabStopRef.current = null; return }
        if (a.currentTime >= endSec) {
          a.pause()
          vocabStopRef.current = null
          return
        }
        vocabStopRef.current = requestAnimationFrame(tick)
      }
      a.play()
        .then(() => { vocabStopRef.current = requestAnimationFrame(tick) })
        .catch(err => { if (err && err.name !== 'AbortError') console.error('vocab segment play failed', err) })
    }

    if (a.src !== para.audio_url) {
      a.src = para.audio_url
      const onReady = () => { a.removeEventListener('loadedmetadata', onReady); startAndBound() }
      a.addEventListener('loadedmetadata', onReady)
      a.load()
    } else {
      startAndBound()
    }
  }

  // Plays a saved phrase by reusing the story audio segment. Falls back to any
  // cached audio, then browser TTS, when the phrase can't be located in the audio.
  function speakVocab(vocab) {
    const seg = findVocabSegment(vocab.phrase)
    if (seg) { playVocabSegment(seg.para, seg.startMs, seg.endMs); return }
    if (vocab.audio_url) {
      new Audio(vocab.audio_url).play().catch(() => speakFallback(vocab.phrase))
      return
    }
    speakFallback(vocab.phrase)
  }

  function seekVoiceToMs(startMs) {
    if (!isVoiceMode || !audioRef.current) return
    audioRef.current.currentTime = Math.max(0, startMs / 1000)
    const playPromise = audioRef.current.play()
    if (playPromise !== undefined) {
      playPromise.then(() => setIsPlaying(true)).catch(err => {
        if (err && err.name !== 'AbortError') console.error("Word seek-play failed:", err)
        setIsPlaying(false)
      })
    }
  }

  // Renders a paragraph as clickable word spans (Click-to-play mode). Preserves the
  // original text (incl. punctuation) by rebuilding from source characters.
  // - Voice mode: click seeks the whole-story audio to the word's start_ms.
  // - Paragraph mode: click plays THIS paragraph's audio from the word's start_ms.
  function renderClickableWords(p) {
    const words = isVoiceMode ? (voiceWordMap.get(p.id) || []) : (p.word_timestamps || [])
    if (words.length === 0) return renderHighlightedText(p.content)

    const text = p.content
    const onWord = (startMs) => (e) => {
      e.stopPropagation()
      // If the user is highlighting text (to save vocab), don't hijack the click.
      if (window.getSelection()?.toString().trim()) return
      if (isVoiceMode) seekVoiceToMs(startMs)
      else playParagraphFromMs(p, startMs)
    }

    const nodes = []
    let searchFrom = 0
    words.forEach((w, wi) => {
      const idx = text.toLowerCase().indexOf(w.word.toLowerCase(), searchFrom)
      if (idx < 0) return // mismatch between source and alignment — skip cleanly
      if (idx > searchFrom) {
        nodes.push(<span key={`gap-${wi}`}>{text.slice(searchFrom, idx)}</span>)
      }
      const original = text.slice(idx, idx + w.word.length)
      nodes.push(
        <span
          key={`w-${wi}`}
          onClick={onWord(w.start_ms)}
          className="cursor-pointer rounded px-0.5 hover:bg-emerald-100 hover:text-emerald-900 transition-colors"
          title={`Jump to ${(w.start_ms/1000).toFixed(1)}s`}
        >
          {original}
        </span>
      )
      searchFrom = idx + w.word.length
    })
    if (searchFrom < text.length) {
      nodes.push(<span key="tail">{text.slice(searchFrom)}</span>)
    }
    return nodes
  }

  function renderHighlightedText(text) {
    if (!showVocabulary || userVocab.length === 0) return text

    // Sort by length descending to match longer phrases first
    const sortedVocab = [...userVocab].sort((a, b) => b.phrase.length - a.phrase.length)
    const phrases = sortedVocab.map(v => v.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const pattern = new RegExp(`(\\b(?:${phrases.join('|')})\\b)`, 'gi')

    const parts = text.split(pattern)
    return parts.map((part, i) => {
      const matchVocab = sortedVocab.find(v => v.phrase.toLowerCase() === part.toLowerCase())
      if (matchVocab) {
        return (
          <span
            key={i}
            onClick={(e) => {
              e.stopPropagation()
              // Don't hijack a text selection (used to save more vocab).
              if (window.getSelection()?.toString().trim()) return
              // Play the story-audio segment, same as the chips below the paragraph.
              speakVocab(matchVocab)
            }}
            className="cursor-pointer bg-emerald-100/80 text-emerald-900 px-0.5 rounded border-b-2 border-emerald-400 font-bold transition-all hover:bg-emerald-200"
            title="Click to hear it from the story audio"
          >
            {part}
          </span>
        )
      }
      return part
    })
  }

  // Close settings panel when clicking outside
  useEffect(() => {
    function onOutsideClick(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettings(false)
      }
    }
    if (showSettings) document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [showSettings])

  // ── Audio Event Management ────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      const voice = currentVoiceRef.current
      if (voice) {
        const ms = audio.currentTime * 1000
        setCurrentTime(ms)
        const active = voice.timestamps?.find(ts => ms >= ts.start_ms && ms <= ts.end_ms)
        setActiveParagraphId(active ? active.paragraph_id : null)
      } else {
        setParaCurrentTime(audio.currentTime)
      }
    }

    const onDurationChange = () => {
      if (!currentVoiceRef.current) setParaDuration(audio.duration || 0)
    }

    const onEnded = () => {
      const voice = currentVoiceRef.current

      if (voice) {
        if (isLoopingRef.current) {
          audio.currentTime = 0
          audio.play().catch(err => console.error("Voice loop failed:", err))
          setIsPlaying(true)
        } else {
          setIsPlaying(false)
          setActiveParagraphId(null)
        }
      } else {
        setParaIsPlaying(false)
        if (singlePlayRef.current) {
          singlePlayRef.current = false
          return
        }
        const s = storyRef.current
        const currentId = playingParaIdRef.current
        if (!s || !currentId) return

        const idx = s.paragraphs.findIndex(p => p.id === currentId)
        const next = s.paragraphs.slice(idx + 1).find(p => p.audio_url)

        if (next) {
          paraDelayRef.current = setTimeout(() => playParagraphRef.current?.(next), 600)
        } else if (isLoopingRef.current) {
          const first = s.paragraphs.find(p => p.audio_url)
          if (first) paraDelayRef.current = setTimeout(() => playParagraphRef.current?.(first), 600)
        }
      }
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
      if (paraDelayRef.current) clearTimeout(paraDelayRef.current)
    }
  }, [story]) // Re-runs when story loads (audio element appears in DOM)

  // ── Audio Controls ─────────────────────────────────────────────────────────
  function toggleVoicePlay() {
    if (!audioRef.current) return
    if (audioRef.current.paused) {
      const playPromise = audioRef.current.play()
      if (playPromise !== undefined) {
        playPromise.then(() => setIsPlaying(true)).catch(err => {
          console.error("Voice playback failed:", err)
          setIsPlaying(false)
        })
      }
    } else {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }

  function handleParagraphClick(pId) {
    if (!currentVoice || !audioRef.current) return
    const ts = currentVoice.timestamps?.find(t => t.paragraph_id === pId)
    if (ts) {
      audioRef.current.currentTime = ts.start_ms / 1000
      const playPromise = audioRef.current.play()
      if (playPromise !== undefined) {
        playPromise.then(() => setIsPlaying(true)).catch(err => {
          console.error("Paragraph seek-play failed:", err)
          setIsPlaying(false)
        })
      }
    }
  }

  // Paragraph-mode controls
  function playParagraph(para) {
    if (!audioRef.current) return

    const audio = audioRef.current
    audio.pause()
    audio.src = para.audio_url

    setPlayingParaId(para.id)
    setParaCurrentTime(0)
    setActiveParagraphId(para.id)

    const playPromise = audio.play()
    if (playPromise !== undefined) {
      playPromise.then(() => {
        setParaIsPlaying(true)
      }).catch(error => {
        console.error("Paragraph playback failed:", error)
        setParaIsPlaying(false)
      })
    }
  }
  playParagraphRef.current = playParagraph

  // Plays a paragraph's own audio starting at a given ms offset (Click-to-play word).
  // If the paragraph's audio isn't loaded yet, waits for metadata before seeking.
  function playParagraphFromMs(para, ms) {
    if (!audioRef.current || !para.audio_url) return
    const audio = audioRef.current
    const target = Math.max(0, ms / 1000)

    const seekAndPlay = () => {
      try { audio.currentTime = target } catch { /* ignore */ }
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.then(() => setParaIsPlaying(true)).catch(err => {
          if (err && err.name !== 'AbortError') console.error("Word play failed:", err)
          setParaIsPlaying(false)
        })
      }
    }

    const alreadyLoaded = playingParaIdRef.current === para.id && audio.src && audio.readyState >= 1
    if (alreadyLoaded) {
      seekAndPlay()
      return
    }

    audio.pause()
    audio.src = para.audio_url
    setPlayingParaId(para.id)
    setParaCurrentTime(0)
    setActiveParagraphId(para.id)

    const onReady = () => {
      audio.removeEventListener('loadedmetadata', onReady)
      seekAndPlay()
    }
    audio.addEventListener('loadedmetadata', onReady)
    audio.load()
  }

  function playSingleParagraph(para) {
    singlePlayRef.current = true
    playParagraph(para)
  }

  // Auto-scroll to active paragraph
  useEffect(() => {
    if (!activeParagraphId) return
    const el = paraRefs.current[activeParagraphId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeParagraphId])

  function toggleParagraph(para) {
    if (!audioRef.current) return
    if (playingParaId === para.id) {
      if (paraIsPlaying) { audioRef.current.pause(); setParaIsPlaying(false) }
      else { 
        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
          playPromise.then(() => setParaIsPlaying(true)).catch(err => {
            console.error("Paragraph resume failed:", err)
            setParaIsPlaying(false)
          })
        }
      }
    } else {
      playParagraph(para)
    }
  }
  function paraSeek(e) {
    if (!audioRef.current || !paraDuration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percent = clickX / rect.width
    const newTime = percent * paraDuration
    
    // Safety check
    if (isNaN(newTime) || newTime < 0) return
    
    audioRef.current.currentTime = newTime
    setParaCurrentTime(newTime)
  }

  async function handleMarkAsReviewed() {
    setShowReviewModal(false)
    setIsReviewing(true)
    try {
      await markStoryAsReviewed(id, token)
      // Navigate back to library immediately after success
      navigate('/')
    } catch (err) {
      alert("Error marking as reviewed: " + err.message)
    } finally {
      setIsReviewing(false)
    }
  }

  const isVoiceMode = !!currentVoice
  const hasParagraphAudio = story?.paragraphs?.some(p => p.audio_url)
  const playingPara = story?.paragraphs?.find(p => p.id === playingParaId)
  const c = T[theme]

  // Whole-story voice word map (used only in voice mode): paragraph_id -> words.
  const voiceWordMap = useMemo(() => {
    const map = new Map()
    const words = currentVoice?.word_timestamps || []
    for (const w of words) {
      const arr = map.get(w.paragraph_id)
      if (arr) arr.push(w)
      else map.set(w.paragraph_id, [w])
    }
    return map
  }, [currentVoice])

  // Per-paragraph word timestamps (the incremental, per-paragraph audio flow).
  const paraHasWords = !!story?.paragraphs?.some(p => p.word_timestamps?.length > 0)
  const voiceHasWords = voiceWordMap.size > 0
  const hasWordTimestamps = isVoiceMode ? voiceHasWords : paraHasWords
  const wordClickActive = wordClickMode && hasWordTimestamps

  // Logic to determine which image to show
  // Default to first paragraph if no active paragraph yet
  const activePara = story?.paragraphs?.find(p => p.id === activeParagraphId) || story?.paragraphs?.[0]
  let currentImageUrl = null
  
  if (activePara && activePara.images?.length > 0) {
    if (isVoiceMode && isPlaying && currentVoice) {
      const ts = currentVoice.timestamps?.find(t => t.paragraph_id === activePara.id)
      if (ts && ts.end_ms > ts.start_ms) {
        const elapsedInPara = currentTime - ts.start_ms
        const paraDuration = ts.end_ms - ts.start_ms
        const imageIndex = Math.floor((elapsedInPara / paraDuration) * activePara.images.length)
        const safeIndex = Math.min(Math.max(0, imageIndex), activePara.images.length - 1)
        currentImageUrl = activePara.images[safeIndex].image_url
      } else {
        currentImageUrl = activePara.images[0].image_url
      }
    } else {
      currentImageUrl = activePara.images[0].image_url
    }
  }

  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${c.page}`}>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
    </div>
  )
  if (error) return (
    <div className={`min-h-screen flex items-center justify-center ${c.page} p-6`}>
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 text-center max-w-md">
        <p className="text-5xl mb-4">❌</p>
        <h2 className="text-2xl font-bold text-stone-800 mb-2">Error</h2>
        <p className="text-stone-500 mb-6">{error}</p>
        <Link to="/" className="text-emerald-600 font-bold">Back to Library</Link>
      </div>
    </div>
  )

  return (
    <div className={`min-h-screen ${c.page} pb-36 transition-colors duration-300 relative`}>
      {isVoiceMode ? <audio ref={audioRef} src={currentVoice.audio_url} /> : <audio ref={audioRef} />}

      {/* Desktop floating popup — hidden on mobile, hidden in phrases tab (panel handles it) */}
      {selectionBox && activeTab !== 'phrases' && (
        <div
          className="hidden sm:flex fixed z-[60] -translate-x-1/2 animate-in fade-in zoom-in duration-150 flex-col items-center"
          style={{ top: selectionBox.top, left: selectionBox.left }}
        >
          {selectionBox.showBelow && (
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-stone-900" />
          )}
          <button
            onPointerDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); handleAddVocab() }}
            className="bg-stone-900 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 hover:bg-emerald-600 transition-colors select-none"
          >
            <span>+ Save to vocabulary</span>
          </button>
          {!selectionBox.showBelow && (
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-stone-900" />
          )}
        </div>
      )}

      {/* Mobile bottom bar — shown only on mobile when text is selected */}
      {selectedText && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-[60] p-3 animate-in slide-in-from-bottom duration-200">
          <div className="bg-stone-900 rounded-2xl px-4 py-3 flex items-center justify-between shadow-2xl gap-3">
            <p className="text-white text-sm font-bold truncate flex-1 min-w-0">
              "{selectedText}"
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => { setSelectedText(''); setSelectionBox(null); window.getSelection()?.removeAllRanges() }}
                className="w-8 h-8 rounded-xl bg-stone-800 flex items-center justify-center text-stone-400 active:bg-stone-700 touch-manipulation"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                onPointerDown={(e) => e.preventDefault()}
                onClick={(e) => { e.stopPropagation(); handleAddVocab() }}
                className="bg-emerald-600 active:bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors touch-manipulation select-none"
              >
                {activeTab === 'phrases' ? '+ Add phrase' : '+ Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Confirmation Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-stone-900/30">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl mb-6 mx-auto">
              🌟
            </div>
            <h3 className="text-2xl font-bold text-stone-800 text-center mb-2">Mark as Reviewed?</h3>
            <p className="text-stone-500 text-center mb-8 font-medium">
              Are you sure you want to mark this story as reviewed? It will be recorded in your progress statistics.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleMarkAsReviewed}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-2xl transition shadow-lg shadow-emerald-200"
              >
                Yes, Mark as Reviewed
              </button>
              <button
                onClick={() => setShowReviewModal(false)}
                className="w-full bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold py-3 rounded-2xl transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <header className={`border-b px-6 py-4 sticky top-0 z-40 transition-colors duration-300 ${c.nav}`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <Link to="/" className={`transition font-medium flex-shrink-0 ${c.navLink}`}>← Library</Link>
          
          <h1 className={`text-base font-bold truncate hidden sm:block ${c.navTitle}`}>{story.title}</h1>

          <div className="flex items-center gap-2">
            {/* Language selector */}
            <div className="flex items-center gap-1 rounded-xl border border-stone-200 p-0.5">
              {[{ code: 'en', flag: '🇺🇸' }, { code: 'pt', flag: '🇧🇷' }].map(({ code, flag }) => (
                <button
                  key={code}
                  onClick={() => handleLanguageChange(code)}
                  title={code === 'en' ? 'English' : 'Português'}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-base transition-all ${
                    targetLanguage === code ? c.chipActive : c.chip
                  }`}
                >
                  {flag}
                </button>
              ))}
            </div>

            {/* Minimal controls visible only on scroll or always in nav for simplicity */}
            <div className={`flex items-center gap-1 transition-all duration-500 ${isSticky ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
              <button onClick={() => setShowTranslation(v => !v)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs border transition-all ${showTranslation ? c.chipActive : c.chip}`}>🌐</button>
              <button onClick={() => setShowVocabulary(v => !v)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs border transition-all ${showVocabulary ? c.chipActive : c.chip}`}>📖</button>
              <button onClick={() => setShowImages(v => !v)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs border transition-all ${showImages ? c.chipActive : c.chip}`}>🖼️</button>
              {hasWordTimestamps && (
                <button onClick={() => setWordClickMode(v => !v)} title="Click a word to jump audio" className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs border transition-all ${wordClickMode ? c.chipActive : c.chip}`}>🎯</button>
              )}
              <button onClick={() => setIsLooping(v => !v)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs border transition-all ${isLooping ? 'bg-amber-500 text-white border-amber-500' : c.chip}`}>🔁</button>
              <div className="w-px h-4 bg-stone-200 mx-1" />
            </div>

            {/* Reading settings button */}
            <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
                showSettings ? c.chipActive : c.chip
              }`}
            >
              <span className="text-base leading-none">Aa</span>
            </button>

            {showSettings && (
              <div className={`absolute right-0 top-full mt-2 w-64 rounded-2xl border p-4 z-50 transition-colors duration-300 ${c.settingsPanel}`}>
                {/* Theme */}
                <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${c.settingsLabel}`}>Theme</p>
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {[
                    { key: 'light', icon: '☀️', label: 'Light' },
                    { key: 'sepia', icon: '📜', label: 'Sepia' },
                    { key: 'night', icon: '🌙', label: 'Night' },
                  ].map(({ key, icon, label }) => (
                    <button
                      key={key}
                      onClick={() => setTheme(key)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        theme === key ? c.chipActive : c.chip
                      }`}
                    >
                      <span className="text-lg">{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Font size — +/- control */}
                <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${c.settingsLabel}`}>Text size</p>
                <div className={`flex items-center justify-between rounded-xl border px-1 py-1 ${c.chip}`}>
                  <button
                    onClick={() => setFontSize(s => Math.max(FONT_MIN, s - FONT_STEP))}
                    disabled={fontSize <= FONT_MIN}
                    className={`w-9 h-9 rounded-lg text-xl font-bold flex items-center justify-center transition-all disabled:opacity-30 ${c.chip}`}
                  >
                    −
                  </button>
                  <span className={`text-sm font-semibold tabular-nums ${c.settingsLabel}`}>
                    {fontSize}px
                  </span>
                  <button
                    onClick={() => setFontSize(s => Math.min(FONT_MAX, s + FONT_STEP))}
                    disabled={fontSize >= FONT_MAX}
                    className={`w-9 h-9 rounded-lg text-xl font-bold flex items-center justify-center transition-all disabled:opacity-30 ${c.chip}`}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className={`border-b transition-colors duration-300 ${c.hero}`}>
        <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col items-center text-center">
          <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full mb-4 tracking-widest uppercase">
            Level {story.level}
          </span>
          <h2 className={`text-4xl sm:text-5xl font-bold mb-3 tracking-tight leading-tight transition-colors duration-300 ${c.heroTitle}`}>
            {story.title}
          </h2>
          <p className={`text-lg italic transition-colors duration-300 ${c.heroSub}`}>Written by {story.author}</p>
          
          {/* Hero Controls - Fade out on scroll */}
          <div ref={controlsRef} className={`mt-8 flex flex-wrap items-center justify-center gap-2 transition-all duration-300 ${isSticky ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
            <button
              onClick={() => setShowTranslation(v => !v)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                showTranslation ? c.chipActive : c.chip
              }`}
            >
              🌐 Translation
            </button>
            <button
              onClick={() => setShowVocabulary(v => !v)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                showVocabulary ? c.chipActive : c.chip
              }`}
            >
              📖 Vocabulary
            </button>
            <button
              onClick={() => setShowImages(v => !v)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                showImages ? c.chipActive : c.chip
              }`}
            >
              🖼️ Images
            </button>
            {hasWordTimestamps && (
              <button
                onClick={() => setWordClickMode(v => !v)}
                title="Click any word to jump the audio to that point"
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  wordClickMode ? c.chipActive : c.chip
                }`}
              >
                🎯 Click-to-play
              </button>
            )}
            <Link
              to={`/stories/${id}/evaluation`}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${c.chip} hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200`}
            >
              📝 Evaluate
            </Link>
            {user?.roles?.includes('admin') && (
              <Link
                to={`/admin/stories/${id}/sentences`}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${c.chip} hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200`}
              >
                ⚙️ Manage Sentences
              </Link>
            )}
            <button
              onClick={() => setIsLooping(v => !v)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                isLooping ? 'bg-amber-500 text-white border-amber-500' : c.chip
              }`}
            >
              🔁 {isLooping ? 'Looping ON' : 'Infinite Play'}
            </button>
          </div>

          {/* Voice selector */}
          {(story.voices?.length > 0 || hasParagraphAudio) && (
            <div className="mt-8 flex items-center gap-3">
              <span className={`text-xs font-bold uppercase ${c.settingsLabel}`}>Audio:</span>
              <div className={`flex p-1 rounded-xl ${theme === 'night' ? 'bg-stone-800' : 'bg-stone-100'}`}>
                {story.voices?.map(v => (
                  <button key={`voice-${v.id}`}
                    onClick={() => { 
                      const wasPlaying = isPlaying || paraIsPlaying
                      setCurrentVoice(v)
                      setPlayingParaId(null)
                      if (wasPlaying) setTimeout(() => audioRef.current?.play(), 100)
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      currentVoice?.id === v.id ? 'bg-white text-emerald-700 shadow-sm' : `${c.heroSub} hover:text-emerald-600`
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
                {hasParagraphAudio && (
                  <button
                    onClick={() => { 
                      audioRef.current?.pause()
                      setCurrentVoice(null)
                      setIsPlaying(false)
                      setParaIsPlaying(false)
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      !currentVoice ? 'bg-white text-emerald-700 shadow-sm' : `${c.heroSub} hover:text-emerald-600`
                    }`}
                  >
                    Paragraphs
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className={`border-b transition-colors duration-300 ${c.hero} sticky top-[61px] z-30`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex">
            {[
              { key: 'read', label: 'Read' },
              { key: 'phrases', label: `Phrases${userVocab.length > 0 ? ` (${userVocab.length})` : ''}` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors -mb-px ${
                  activeTab === tab.key
                    ? 'border-emerald-500 text-emerald-600'
                    : `border-transparent ${c.heroSub} hover:text-stone-600`
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area — Read Tab */}
      {activeTab === 'read' && (
      <div className={`max-w-7xl mx-auto px-6 grid grid-cols-1 ${showImages ? 'lg:grid-cols-2' : ''} gap-12 items-start`}>
        {/* Paragraphs Column */}
        <div className={showImages ? 'max-w-2xl' : 'max-w-3xl mx-auto w-full'}>
          {story.paragraphs?.map((p, idx) => {
            const isActive = activeParagraphId === p.id
            const isThisParaPlaying = !isVoiceMode && playingParaId === p.id && paraIsPlaying
            
            // Filter user vocab that exists in THIS paragraph
            const vocabInPara = userVocab.filter(v => 
              p.content.toLowerCase().includes(v.phrase.toLowerCase())
            )

            return (
              <div key={`para-${p.id}`} ref={el => { paraRefs.current[p.id] = el }} className={`mb-14 transition-all duration-500 rounded-3xl p-4 -mx-4 ${isActive ? c.paraActive : ''}`}>
                <div className="flex items-start gap-3 mb-4">
                  <span className={`font-mono text-sm flex-shrink-0 mt-1 transition-colors ${isActive ? c.paraNumActive : c.paraNumIdle}`}>
                    {(idx + 1).toString().padStart(2, '0')}
                  </span>

                  <p
                    onClick={() => !wordClickActive && isVoiceMode && handleParagraphClick(p.id)}
                    style={{ fontSize: `${fontSize}px` }}
                    className={`flex-1 leading-relaxed font-serif transition-colors duration-300 ${isVoiceMode && !wordClickActive ? 'cursor-pointer' : ''} ${isActive ? c.paraTextActive : c.paraText}`}
                  >
                    {wordClickActive ? renderClickableWords(p) : renderHighlightedText(p.content)}
                  </p>

                  {!isVoiceMode && p.audio_url && (
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {/* Auto-advance play button */}
                      <button
                        onClick={() => toggleParagraph(p)}
                        title="Play and continue"
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                          isThisParaPlaying
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20'
                            : c.playBtn
                        }`}
                      >
                        {isThisParaPlaying
                          ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                          : <svg className="w-4 h-4 translate-x-px" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                        }
                      </button>
                      {/* Single-paragraph play button */}
                      <button
                        onClick={() => playSingleParagraph(p)}
                        title="Play only this paragraph"
                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all border ${c.playBtn}`}
                      >
                        <svg className="w-3.5 h-3.5 translate-x-px" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[9px] font-black leading-none -ml-0.5">1</span>
                      </button>
                    </div>
                  )}
                </div>

                {showTranslation && p.translations?.length > 0 && (
                  <div className={`ml-8 rounded-2xl px-5 py-4 border mb-3 transition-all duration-300 ${isActive ? c.transCardActive : c.transCard}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest block mb-2 ${isActive ? c.transLabelActive : c.transLabel}`}>Translation</span>
                    {p.translations.map(t => (
                      <p key={`trans-${t.id}`} className={`text-base leading-relaxed italic ${c.transText}`}>{t.content}</p>
                    ))}
                  </div>
                )}

                {showVocabulary && vocabInPara.length > 0 && (
                  <div className="ml-8 mt-4 flex flex-wrap gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                    {vocabInPara.map((v) => (
                      <div key={`vocab-item-${v.id}`} className={`group flex items-center overflow-hidden rounded-xl text-sm border shadow-sm transition-all hover:border-emerald-300 ${c.vocabChip} border-emerald-100 bg-emerald-50/30`}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); speakVocab(v) }}
                          className="px-3 py-1.5 font-bold text-emerald-700 hover:bg-emerald-100/50 transition-colors flex items-center gap-2"
                        >
                          {v.phrase}
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteVocab(v.id) }}
                          title="Remove"
                          className="px-2 py-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 transition-all border-l border-emerald-100"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <div className={`mt-20 py-12 border-t text-center ${c.divider}`}>
            <p className={`text-sm mb-6 ${c.endText}`}>You've reached the end of the story.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setShowReviewModal(true)}
                disabled={isReviewing || reviewed}
                className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-bold transition-all shadow-lg active:scale-95 ${
                  reviewed 
                    ? 'bg-stone-200 text-stone-500 cursor-default' 
                    : 'bg-white text-emerald-600 border border-emerald-100 hover:border-emerald-600'
                }`}
              >
                {reviewed ? '✓ Reviewed' : isReviewing ? 'Marking...' : '🌟 Mark as Reviewed'}
              </button>
              <Link to="/" className="inline-block bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-500 transition shadow-lg">
                Back to Library
              </Link>
            </div>
          </div>
        </div>

        {/* Visual Content Column (Sticky) */}
        {showImages && (
          <div className="hidden lg:block sticky top-32 max-w-sm ml-auto w-full">
            <div className="aspect-[4/3] rounded-[2rem] overflow-hidden bg-stone-100 shadow-xl border border-stone-200/50 relative group">
              {currentImageUrl ? (
                <>
                  {/* Blurred background layer for "fill" effect */}
                  <img 
                    src={currentImageUrl} 
                    className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30 scale-110" 
                    alt="" 
                  />
                  {/* Main sharp image */}
                  <img 
                    key={currentImageUrl}
                    src={currentImageUrl} 
                    className="relative w-full h-full object-contain animate-in fade-in zoom-in-95 duration-500" 
                    alt="" 
                  />
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-stone-300 gap-4">
                  <span className="text-6xl opacity-10">📖</span>
                  <p className="text-xs font-medium opacity-40">Ready to start</p>
                </div>
              )}
              
              {/* Subtle inner shadow overlay */}
              <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-[2rem] pointer-events-none" />
            </div>
            
            {/* Image indicator dot for multi-image paragraphs */}
            {activePara?.images?.length > 1 && (
               <div className="mt-4 flex justify-center gap-1.5">
                 {activePara.images.map((_, i) => {
                    const ts = currentVoice?.timestamps?.find(t => t.paragraph_id === activePara.id)
                    const idx = ts ? Math.min(Math.max(0, Math.floor(((currentTime - ts.start_ms) / (ts.end_ms - ts.start_ms)) * activePara.images.length)), activePara.images.length - 1) : 0
                    return <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === idx ? 'w-6 bg-emerald-500' : 'w-1 bg-stone-300'}`} />
                 })}
               </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Phrases Tab */}
      {activeTab === 'phrases' && (
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-8 items-start">
          {/* Story text — selectable */}
          <div className="flex-1 min-w-0">
            {story.paragraphs?.map((p, idx) => (
              <div key={`phrase-para-${p.id}`} className="mb-12">
                <div className="flex items-start gap-3">
                  <span className={`font-mono text-sm flex-shrink-0 mt-1 ${c.paraNumIdle}`}>
                    {(idx + 1).toString().padStart(2, '0')}
                  </span>
                  <p
                    style={{ fontSize: `${fontSize}px` }}
                    className={`flex-1 leading-relaxed font-serif select-text cursor-text ${c.paraText}`}
                  >
                    {p.content}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Phrases Panel */}
          <div className="w-full lg:w-72 lg:sticky lg:top-28 flex-shrink-0">
            <div className={`rounded-2xl border p-4 ${c.settingsPanel}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-bold text-sm uppercase tracking-wide ${c.settingsLabel}`}>Saved Phrases</h3>
                {userVocab.length > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${c.chip}`}>{userVocab.length}</span>
                )}
              </div>

              {/* Selected text preview */}
              {selectedText && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-[10px] text-emerald-600 font-bold mb-1.5 uppercase tracking-wider">Selected</p>
                  <p className="text-sm font-medium text-emerald-900 mb-3 italic leading-snug">"{selectedText}"</p>
                  <button
                    onPointerDown={e => e.preventDefault()}
                    onClick={handleAddVocab}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition"
                  >
                    + Add phrase
                  </button>
                </div>
              )}

              {userVocab.length === 0 && !selectedText ? (
                <p className={`text-sm text-center py-10 leading-relaxed ${c.heroSub}`}>
                  Select text from the story to add phrases
                </p>
              ) : (
                <ul className="space-y-1.5 max-h-[55vh] overflow-y-auto">
                  {userVocab.map((v, idx) => (
                    <li key={v.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border ${c.vocabChip}`}>
                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => handleMoveVocab(v.id, 'up')}
                          disabled={idx === 0}
                          className={`w-5 h-4 flex items-center justify-center rounded text-xs leading-none transition ${
                            idx === 0 ? 'text-stone-300 cursor-default' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => handleMoveVocab(v.id, 'down')}
                          disabled={idx === userVocab.length - 1}
                          className={`w-5 h-4 flex items-center justify-center rounded text-xs leading-none transition ${
                            idx === userVocab.length - 1 ? 'text-stone-300 cursor-default' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          ▼
                        </button>
                      </div>
                      <button
                        onClick={() => speakVocab(v)}
                        className="flex-1 text-sm font-medium text-left truncate hover:text-emerald-600 transition"
                        title={v.phrase}
                      >
                        {v.phrase}
                      </button>
                      <button
                        onClick={() => handleDeleteVocab(v.id)}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 transition"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating player — Voice mode */}
      {isVoiceMode && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50">
          <div className="bg-stone-900/90 backdrop-blur-md text-white rounded-3xl shadow-2xl p-4 flex items-center gap-4 border border-white/10">
            <button onClick={toggleVoicePlay} className="w-12 h-12 bg-emerald-600 hover:bg-emerald-500 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95 flex-shrink-0">
              {isPlaying
                ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                : <svg className="w-5 h-5 translate-x-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
              }
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-semibold text-stone-400 truncate">{isPlaying ? 'Listening now…' : currentVoice.name}</span>
                <span className="text-[10px] font-mono text-stone-500 flex-shrink-0 ml-2">
                  {formatTime(currentTime)} / {formatTime((audioRef.current?.duration || 0) * 1000)}
                </span>
              </div>
              <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(currentTime / ((audioRef.current?.duration || 1) * 1000)) * 100}%` }} />
              </div>
            </div>
            <span className="text-xl flex-shrink-0">🎧</span>
          </div>
        </div>
      )}

      {/* Floating player — Paragraph mode */}
      {!isVoiceMode && hasParagraphAudio && playingParaId && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50">
          <div className="bg-stone-900/90 backdrop-blur-md text-white rounded-3xl shadow-2xl p-4 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => playingPara && toggleParagraph(playingPara)} className="w-10 h-10 bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center justify-center transition-all active:scale-95 flex-shrink-0">
                {paraIsPlaying
                  ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  : <svg className="w-4 h-4 translate-x-px" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                }
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-stone-400 font-semibold mb-0.5">
                  Paragraph {story.paragraphs.findIndex(p => p.id === playingParaId) + 1}
                  {paraIsPlaying ? ' · Playing' : ' · Paused'}
                </p>
                <p className="text-xs text-stone-500 truncate italic">{playingPara?.content}</p>
              </div>
              <span className="text-[10px] font-mono text-stone-500 flex-shrink-0">
                {formatTime(paraCurrentTime * 1000)} / {formatTime(paraDuration * 1000)}
              </span>
            </div>
            <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden cursor-pointer" onClick={paraSeek}>
              <div className="h-full bg-emerald-500 transition-all duration-100"
                style={{ width: `${paraDuration ? (paraCurrentTime / paraDuration) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatTime(ms) {
  if (!ms || isNaN(ms)) return '0:00'
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}
