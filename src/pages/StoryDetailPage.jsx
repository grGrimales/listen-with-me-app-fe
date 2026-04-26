import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getStory, markStoryAsReviewed } from '../api/stories'

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
  const { token } = useAuth()
  const [story, setStory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Reading preferences (persisted)
  const [showTranslation, setShowTranslation] = useState(false)
  const [showVocabulary, setShowVocabulary] = useState(false)
  const [showImages, setShowImages] = useState(() => localStorage.getItem('rwm_showImages') !== 'false')
  const [theme, setTheme] = useState(() => localStorage.getItem('rwm_theme') || 'light')
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('rwm_fontSize')) || FONT_DEFAULT)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => { localStorage.setItem('rwm_theme', theme) }, [theme])
  useEffect(() => { localStorage.setItem('rwm_fontSize', fontSize) }, [fontSize])
  useEffect(() => { localStorage.setItem('rwm_showImages', showImages) }, [showImages])

  // Voice-mode state
  const [currentVoice, setCurrentVoice] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [activeParagraphId, setActiveParagraphId] = useState(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)

  // Paragraph-mode state
  const [playingParaId, setPlayingParaId] = useState(null)
  const [paraIsPlaying, setParaIsPlaying] = useState(false)
  const [paraCurrentTime, setParaCurrentTime] = useState(0)
  const [paraDuration, setParaDuration] = useState(0)

  const audioRef = useRef(null)
  const settingsRef = useRef(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getStory(id, token)
        setStory(data)
        if (data.voices?.length > 0) setCurrentVoice(data.voices[0])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, token])

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

  // Voice-mode audio events
  useEffect(() => {
    if (!currentVoice || !audioRef.current) return
    const audio = audioRef.current
    const onTimeUpdate = () => {
      const ms = audio.currentTime * 1000
      setCurrentTime(ms)
      const active = currentVoice.timestamps?.find(ts => ms >= ts.start_ms && ms <= ts.end_ms)
      setActiveParagraphId(active ? active.paragraph_id : null)
    }
    const onEnded = () => { setIsPlaying(false); setActiveParagraphId(null) }
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    return () => { audio.removeEventListener('timeupdate', onTimeUpdate); audio.removeEventListener('ended', onEnded) }
  }, [currentVoice])

  // Paragraph-mode audio events
  useEffect(() => {
    if (currentVoice || !audioRef.current) return
    const audio = audioRef.current
    const onTimeUpdate = () => setParaCurrentTime(audio.currentTime)
    const onDurationChange = () => setParaDuration(audio.duration || 0)
    const onEnded = () => {
      setParaIsPlaying(false)
      if (!story) return
      const idx = story.paragraphs.findIndex(p => p.id === playingParaId)
      const next = story.paragraphs.slice(idx + 1).find(p => p.audio_url)
      if (next) playParagraph(next)
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
    }
  }, [currentVoice, playingParaId, story])

  // Voice-mode controls
  function toggleVoicePlay() {
    if (!audioRef.current) return
    if (audioRef.current.paused) { audioRef.current.play(); setIsPlaying(true) }
    else { audioRef.current.pause(); setIsPlaying(false) }
  }
  function handleParagraphClick(pId) {
    if (!currentVoice) return
    const ts = currentVoice.timestamps?.find(t => t.paragraph_id === pId)
    if (ts) { audioRef.current.currentTime = ts.start_ms / 1000; audioRef.current.play(); setIsPlaying(true) }
  }

  // Paragraph-mode controls
  function playParagraph(para) {
    if (!audioRef.current) return
    audioRef.current.src = para.audio_url
    audioRef.current.currentTime = 0
    audioRef.current.play()
    setPlayingParaId(para.id)
    setParaIsPlaying(true)
    setParaCurrentTime(0)
    setActiveParagraphId(para.id)
  }
  function toggleParagraph(para) {
    if (!audioRef.current) return
    if (playingParaId === para.id) {
      if (paraIsPlaying) { audioRef.current.pause(); setParaIsPlaying(false) }
      else { audioRef.current.play(); setParaIsPlaying(true) }
    } else {
      playParagraph(para)
    }
  }
  function paraSeek(e) {
    if (!audioRef.current || !paraDuration) return
    const rect = e.currentTarget.getBoundingClientRect()
    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * paraDuration
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

      {/* Review Confirmation Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-stone-900/30">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl mb-6 mx-auto">
              🌟
            </div>
            <h3 className="text-2xl font-bold text-stone-800 text-center mb-2">Mark as Reviewed?</h3>
            <p className="text-stone-500 text-center mb-8 font-medium">
              ¿Estás seguro de que quieres marcar esta historia como revisada? Se registrará en tus estadísticas de progreso.
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
      <header className={`border-b px-6 py-4 sticky top-0 z-20 transition-colors duration-300 ${c.nav}`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className={`transition font-medium ${c.navLink}`}>← Library</Link>
          <h1 className={`text-lg font-bold truncate max-w-[200px] sm:max-w-md ${c.navTitle}`}>{story.title}</h1>
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
      </header>

      {/* Hero */}
      <div className={`border-b mb-8 transition-colors duration-300 ${c.hero}`}>
        <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col items-center text-center">
          <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full mb-4 tracking-widest uppercase">
            Level {story.level}
          </span>
          <h2 className={`text-4xl sm:text-5xl font-bold mb-3 tracking-tight leading-tight transition-colors duration-300 ${c.heroTitle}`}>
            {story.title}
          </h2>
          <p className={`text-lg italic transition-colors duration-300 ${c.heroSub}`}>Written by {story.author}</p>

          {/* Translation / Vocabulary toggles — separate from text-format settings */}
          <div className="flex items-center gap-2 mt-6 flex-wrap justify-center">
            <span className={`text-xs font-medium mr-1 ${c.heroSub}`}>Show:</span>
            <button
              onClick={() => setShowTranslation(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                showTranslation ? c.chipActive : c.chip
              }`}
            >
              🌐 Translation
            </button>
            <button
              onClick={() => setShowVocabulary(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                showVocabulary ? c.chipActive : c.chip
              }`}
            >
              📖 Vocabulary
            </button>
            <button
              onClick={() => setShowImages(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                showImages ? c.chipActive : c.chip
              }`}
            >
              🖼️ Images
            </button>
          </div>

          {/* Voice selector */}
          {story.voices?.length > 1 && (
            <div className="mt-6 flex items-center gap-3">
              <span className={`text-xs font-bold uppercase ${c.settingsLabel}`}>Voice:</span>
              <div className={`flex p-1 rounded-xl ${theme === 'night' ? 'bg-stone-800' : 'bg-stone-100'}`}>
                {story.voices.map(v => (
                  <button key={v.id}
                    onClick={() => { const wasPlaying = isPlaying; setCurrentVoice(v); if (wasPlaying) setTimeout(() => audioRef.current?.play(), 100) }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      currentVoice?.id === v.id ? 'bg-white text-emerald-700 shadow-sm' : `${c.heroSub} hover:text-emerald-600`
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`max-w-7xl mx-auto px-6 grid grid-cols-1 ${showImages ? 'lg:grid-cols-2' : ''} gap-12 items-start`}>
        {/* Paragraphs Column */}
        <div className={showImages ? 'max-w-2xl' : 'max-w-3xl mx-auto w-full'}>
          {story.paragraphs?.map((p, idx) => {
            const isActive = activeParagraphId === p.id
            const isThisParaPlaying = !isVoiceMode && playingParaId === p.id && paraIsPlaying

            return (
              <div key={p.id} className={`mb-14 transition-all duration-500 rounded-3xl p-4 -mx-4 ${isActive ? c.paraActive : ''}`}>
                <div className="flex items-start gap-3 mb-4">
                  <span className={`font-mono text-sm flex-shrink-0 mt-1 transition-colors ${isActive ? c.paraNumActive : c.paraNumIdle}`}>
                    {(idx + 1).toString().padStart(2, '0')}
                  </span>

                  <p
                    onClick={() => isVoiceMode && handleParagraphClick(p.id)}
                    style={{ fontSize: `${fontSize}px` }}
                    className={`flex-1 leading-relaxed font-serif transition-colors duration-300 ${isVoiceMode ? 'cursor-pointer' : ''} ${isActive ? c.paraTextActive : c.paraText}`}
                  >
                    {p.content}
                  </p>

                  {!isVoiceMode && p.audio_url && (
                    <button
                      onClick={() => toggleParagraph(p)}
                      className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
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
                  )}
                </div>

                {showTranslation && p.translations?.length > 0 && (
                  <div className={`ml-8 rounded-2xl px-5 py-4 border mb-3 transition-all duration-300 ${isActive ? c.transCardActive : c.transCard}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-widest block mb-2 ${isActive ? c.transLabelActive : c.transLabel}`}>Translation</span>
                    {p.translations.map(t => (
                      <p key={t.id} className={`text-base leading-relaxed italic ${c.transText}`}>{t.content}</p>
                    ))}
                  </div>
                )}

                {showVocabulary && p.vocabulary?.length > 0 && (
                  <div className="ml-8 mt-2 flex flex-wrap gap-2">
                    {p.vocabulary.map(v => (
                      <div key={v.id} className={`px-3 py-1.5 rounded-xl text-sm border shadow-sm ${c.vocabChip}`}>
                        <span className="font-bold text-emerald-600">{v.word}</span>
                        <span className="opacity-30 mx-1.5">·</span>
                        <span>{v.definition}</span>
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
