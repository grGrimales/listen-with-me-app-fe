import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getStory } from '../api/stories'

export default function StoryDetailPage() {
  const { id } = useParams()
  const { token } = useAuth()
  const [story, setStory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Audio state
  const [currentVoice, setCurrentVoice] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [activeParagraphId, setActiveParagraphId] = useState(null)
  const audioRef = useRef(null)

  useEffect(() => {
    async function loadStory() {
      try {
        const data = await getStory(id, token)
        setStory(data)
        if (data.voices?.length > 0) {
          setCurrentVoice(data.voices[0])
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadStory()
  }, [id, token])

  useEffect(() => {
    if (!currentVoice || !audioRef.current) return

    const audio = audioRef.current
    
    const handleTimeUpdate = () => {
      const timeMs = audio.currentTime * 1000
      setCurrentTime(timeMs)
      
      // Find active paragraph based on timestamps
      const active = currentVoice.timestamps.find(
        ts => timeMs >= ts.start_ms && timeMs <= ts.end_ms
      )
      
      if (active) {
        setActiveParagraphId(active.paragraph_id)
      } else {
        setActiveParagraphId(null)
      }
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setActiveParagraphId(null)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [currentVoice])

  const togglePlay = () => {
    if (audioRef.current.paused) {
      audioRef.current.play()
      setIsPlaying(true)
    } else {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }

  const handleParagraphClick = (pId) => {
    if (!currentVoice) return
    
    const ts = currentVoice.timestamps.find(t => t.paragraph_id === pId)
    if (ts) {
      audioRef.current.currentTime = ts.start_ms / 1000
      if (!isPlaying) {
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 text-center max-w-md">
        <span className="text-5xl mb-4 block">❌</span>
        <h2 className="text-2xl font-bold text-stone-800 mb-2">Error</h2>
        <p className="text-stone-500 mb-6">{error}</p>
        <Link to="/" className="text-emerald-600 font-bold">Back to Library</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-stone-50 pb-32">
      <audio ref={audioRef} src={currentVoice?.audio_url} />
      
      {/* Header / Nav */}
      <header className="bg-white border-b border-stone-200 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-stone-500 hover:text-stone-800 transition flex items-center gap-1 font-medium">
            ← Library
          </Link>
          <div className="text-center">
            <h1 className="text-lg font-bold text-stone-800 truncate max-w-[200px] sm:max-w-md">
              {story.title}
            </h1>
          </div>
          <div className="w-10"></div> {/* Spacer */}
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-white border-b border-stone-200 mb-8">
        <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col items-center text-center">
          <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full mb-4 tracking-widest uppercase">
            Level {story.level}
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-stone-900 mb-4 tracking-tight leading-tight">
            {story.title}
          </h2>
          <p className="text-stone-500 text-lg italic">Written by {story.author}</p>
          
          {story.voices?.length > 1 && (
            <div className="mt-6 flex items-center gap-3">
              <span className="text-xs font-bold text-stone-400 uppercase">Voice:</span>
              <div className="flex bg-stone-100 p-1 rounded-xl">
                {story.voices.map(v => (
                  <button
                    key={v.id}
                    onClick={() => {
                      const wasPlaying = isPlaying
                      setCurrentVoice(v)
                      if (wasPlaying) {
                        setTimeout(() => audioRef.current.play(), 100)
                      }
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      currentVoice?.id === v.id 
                        ? 'bg-white text-emerald-700 shadow-sm' 
                        : 'text-stone-500 hover:text-stone-800'
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

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6">
        {story.paragraphs?.map((p, idx) => {
          const isActive = activeParagraphId === p.id
          return (
            <div 
              key={p.id} 
              className={`mb-16 transition-all duration-500 rounded-3xl p-4 -mx-4 ${
                isActive ? 'bg-emerald-50/50 ring-1 ring-emerald-100 shadow-sm' : ''
              }`}
            >
              <div className="relative">
                <span className={`absolute -left-10 top-1 font-mono text-sm hidden sm:block transition-colors ${
                  isActive ? 'text-emerald-500 font-bold' : 'text-stone-300'
                }`}>
                  {(idx + 1).toString().padStart(2, '0')}
                </span>
                <p 
                  onClick={() => handleParagraphClick(p.id)}
                  className={`text-2xl leading-relaxed mb-6 font-serif cursor-pointer transition-colors duration-300 ${
                    isActive ? 'text-emerald-900' : 'text-stone-800 hover:text-stone-600'
                  }`}
                >
                  {p.content}
                </p>
              </div>

              {/* Translation Card */}
              <div className={`rounded-2xl p-6 border transition-all duration-500 ${
                isActive ? 'bg-white border-emerald-100 shadow-sm' : 'bg-stone-100/50 border-stone-200/50'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold uppercase tracking-widest ${
                    isActive ? 'text-emerald-500' : 'text-stone-400'
                  }`}>Translation</span>
                  <div className={`h-[1px] flex-1 ${isActive ? 'bg-emerald-100' : 'bg-stone-200'}`}></div>
                </div>
                {p.translations?.map(t => (
                  <p key={t.id} className="text-stone-600 text-lg leading-relaxed italic">
                    {t.content}
                  </p>
                ))}

                {/* Vocabulary Chips */}
                {p.vocabulary?.length > 0 && (
                  <div className={`mt-6 pt-6 border-t ${isActive ? 'border-emerald-50' : 'border-stone-200/50'}`}>
                    <div className="flex flex-wrap gap-2">
                      {p.vocabulary.map(v => (
                        <div key={v.id} className="bg-white border border-stone-200 px-4 py-2 rounded-xl text-sm shadow-sm group/vocab">
                          <span className="font-bold text-emerald-700">{v.word}</span>
                          <span className="text-stone-400 mx-2">:</span>
                          <span className="text-stone-600">{v.definition}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        <div className="mt-20 py-12 border-t border-stone-200 text-center">
          <p className="text-stone-400 text-sm mb-6">You've reached the end of the story.</p>
          <Link
            to="/"
            className="inline-block bg-stone-800 text-white px-8 py-3 rounded-2xl font-bold hover:bg-stone-700 transition"
          >
            Back to Library
          </Link>
        </div>
      </div>

      {/* Floating Audio Player */}
      {currentVoice && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50">
          <div className="bg-stone-900 text-white rounded-3xl shadow-2xl p-4 flex items-center gap-4 backdrop-blur-md bg-stone-900/90 border border-white/10">
            <button
              onClick={togglePlay}
              className="w-12 h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
            >
              {isPlaying ? (
                <span className="text-xl">⏸</span>
              ) : (
                <span className="text-xl translate-x-0.5">▶</span>
              )}
            </button>
            
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-stone-400 truncate max-w-[150px]">
                  {isPlaying ? 'Listening now...' : 'Paused'}
                </span>
                <span className="text-[10px] font-mono text-stone-500">
                  {formatTime(currentTime)} / {formatTime(audioRef.current?.duration * 1000 || 0)}
                </span>
              </div>
              <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(currentTime / (audioRef.current?.duration * 1000 || 1)) * 100}%` }}
                />
              </div>
            </div>

            <div className="text-stone-500 pr-2">
              <span className="text-2xl">🎧</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatTime(ms) {
  if (isNaN(ms)) return "0:00"
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

