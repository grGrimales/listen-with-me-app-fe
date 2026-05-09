import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  getStory, 
  getStorySentences, 
  evaluateSentence, 
  getStorySentenceStats,
  generateSentences,
  getSentenceHistory
} from '../api/stories'

export default function StoryEvaluationPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token, user } = useAuth()
  
  const [story, setStory] = useState(null)
  const [sentences, setSentences] = useState([])
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [feedback, setFeedback] = useState(null) // { isCorrect: bool, actual: string }
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [sessionStats, setSessionStats] = useState({ correct: 0, failed: 0 })
  const [completed, setCompleted] = useState(false)

  const inputRef = useRef(null)

  useEffect(() => {
    async function load() {
      try {
        const [storyData, sentenceData, statsData] = await Promise.all([
          getStory(id, token),
          getStorySentences(id, token),
          getStorySentenceStats(id, token)
        ])
        setStory(storyData)
        setSentences(sentenceData)
        setStats(statsData)

        // Resume progress: find the first sentence that hasn't been attempted yet
        if (sentenceData && sentenceData.length > 0) {
          const firstUnattempted = sentenceData.findIndex(s => {
            const sStat = statsData.find(st => st.sentence_id === s.id)
            return !sStat || sStat.total_attempts === 0
          })
          if (firstUnattempted !== -1) {
            setCurrentIndex(firstUnattempted)
          }
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, token])

  useEffect(() => {
    if (feedback === null && inputRef.current) {
      inputRef.current.focus()
    }
  }, [currentIndex, feedback])

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const data = await generateSentences(id, token)
      setSentences(data)
      const statsData = await getStorySentenceStats(id, token)
      setStats(statsData)
    } catch (err) {
      setError("Failed to generate: " + err.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleCheck = async () => {
    if (!userAnswer.trim()) return

    const current = sentences[currentIndex]
    // Simple normalization for comparison
    const normalizedUser = userAnswer.trim().toLowerCase().replace(/[.,!?;:]/g, '')
    const normalizedActual = current.en.trim().toLowerCase().replace(/[.,!?;:]/g, '')
    
    const isCorrect = normalizedUser === normalizedActual
    
    setFeedback({ isCorrect, actual: current.en })
    
    if (isCorrect) {
      setSessionStats(prev => ({ ...prev, correct: prev.correct + 1 }))
    } else {
      setSessionStats(prev => ({ ...prev, failed: prev.failed + 1 }))
    }

    try {
      await evaluateSentence(current.id, {
        is_correct: isCorrect,
        user_answer: isCorrect ? '' : userAnswer.trim()
      }, token)
      
      // Refresh stats in background
      getStorySentenceStats(id, token).then(setStats)
    } catch (err) {
      console.error("Failed to record evaluation:", err)
    }
  }

  const handleNext = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setUserAnswer('')
      setFeedback(null)
      setShowHistory(false)
    } else {
      setCompleted(true)
    }
  }

  const handleViewHistory = async () => {
    if (showHistory) {
      setShowHistory(false)
      return
    }
    
    setLoadingHistory(true)
    setShowHistory(true)
    try {
      const data = await getSentenceHistory(sentences[currentIndex].id, token)
      setHistory(data)
    } catch (err) {
      console.error("Failed to load history:", err)
    } finally {
      setLoadingHistory(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
    </div>
  )

  if (!sentences || sentences.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white p-8 rounded-3xl shadow-sm border border-stone-200">
          <p className="text-5xl mb-4">📝</p>
          <h2 className="text-2xl font-bold text-stone-800 mb-2">No sentences yet</h2>
          <p className="text-stone-500 mb-6">This story hasn't been split into sentences for evaluation yet.</p>
          
          {user?.roles?.includes('admin') ? (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full bg-emerald-600 text-white font-bold py-3 rounded-2xl hover:bg-emerald-500 transition disabled:opacity-50"
            >
              {generating ? 'Generating with Gemini...' : 'Generate Sentences Now'}
            </button>
          ) : (
            <Link to={`/stories/${id}`} className="text-emerald-600 font-bold underline">
              Back to Story
            </Link>
          )}
          {error && <p className="mt-4 text-red-500 text-sm">{error}</p>}
        </div>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-xl border border-stone-100 animate-in zoom-in duration-300">
          <p className="text-6xl mb-6">🎉</p>
          <h2 className="text-3xl font-bold text-stone-800 mb-2">Evaluation Complete!</h2>
          <p className="text-stone-500 mb-8">Great job finishing the sentences for this story.</p>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-emerald-50 p-4 rounded-2xl">
              <p className="text-emerald-600 text-sm font-bold uppercase tracking-wider mb-1">Correct</p>
              <p className="text-3xl font-black text-emerald-700">{sessionStats.correct}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-2xl">
              <p className="text-red-600 text-sm font-bold uppercase tracking-wider mb-1">Failed</p>
              <p className="text-3xl font-black text-red-700">{sessionStats.failed}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                setCompleted(false)
                setCurrentIndex(0)
                setSessionStats({ correct: 0, failed: 0 })
                setFeedback(null)
                setUserAnswer('')
              }}
              className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-500 transition shadow-lg shadow-emerald-200"
            >
              Try Again
            </button>
            <Link 
              to={`/stories/${id}`}
              className="w-full bg-stone-100 text-stone-600 font-bold py-4 rounded-2xl hover:bg-stone-200 transition"
            >
              Back to Story
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const current = sentences[currentIndex]
  const currentStats = stats.find(s => s.sentence_id === current.id) || { correct_count: 0, failed_count: 0, total_attempts: 0 }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <Link to={`/stories/${id}`} className="text-stone-500 hover:text-stone-800 transition font-medium">
            ✕ Exit
          </Link>
          <div className="flex flex-col items-center">
             <h1 className="text-sm font-bold text-stone-400 uppercase tracking-widest leading-none mb-1">Evaluation</h1>
             <p className="text-xs font-bold text-stone-800">{story?.title}</p>
          </div>
          <div className="text-stone-400 font-mono text-sm">
            {currentIndex + 1} / {sentences.length}
          </div>
        </div>
        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-stone-100">
           <div 
             className="h-full bg-emerald-500 transition-all duration-300" 
             style={{ width: `${((currentIndex + 1) / sentences.length) * 100}%` }}
           />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-12">
        {/* Stats Summary */}
        <div className="flex items-center gap-6 mb-12 justify-center">
           <div className="flex items-center gap-2">
             <span className="text-xl">✅</span>
             <span className="font-bold tabular-nums">{sessionStats.correct}</span>
           </div>
           <div className="flex items-center gap-2">
             <span className="text-xl">❌</span>
             <span className="font-bold tabular-nums">{sessionStats.failed}</span>
           </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-stone-200/50 border border-stone-100 overflow-hidden">
          <div className="p-8 sm:p-12">
            {/* Spanish Sentence */}
            <div className="mb-10 text-center">
              <span className="inline-block bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-4">
                Translate from Spanish
              </span>
              <p className="text-2xl sm:text-3xl font-serif leading-relaxed text-stone-900">
                {current.es}
              </p>
            </div>

            {/* Input Area */}
            <div className="space-y-6">
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  disabled={feedback !== null}
                  placeholder="Type the English translation..."
                  className={`w-full bg-stone-50 border-2 rounded-3xl p-6 text-lg font-medium transition-all focus:outline-none min-h-[120px] resize-none
                    ${feedback === null ? 'border-stone-100 focus:border-emerald-500 focus:bg-white' : 
                      feedback.isCorrect ? 'border-emerald-200 bg-emerald-50/30 text-emerald-900' : 'border-red-100 bg-red-50/30 text-red-900'}
                  `}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (feedback === null) handleCheck()
                      else handleNext()
                    }
                  }}
                />
              </div>

              {/* Feedback */}
              {feedback && (
                <div className={`p-6 rounded-3xl animate-in slide-in-from-top-4 duration-300 ${feedback.isCorrect ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                   <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{feedback.isCorrect ? '✨' : '⚠️'}</span>
                      <h4 className={`font-bold ${feedback.isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                        {feedback.isCorrect ? 'Perfect!' : 'Not quite right'}
                      </h4>
                   </div>
                   {!feedback.isCorrect && (
                     <p className="text-red-900 text-lg font-medium leading-relaxed">
                       Correct version: <span className="font-bold underline decoration-red-300 decoration-2">{feedback.actual}</span>
                     </p>
                   )}
                   {feedback.isCorrect && (
                     <p className="text-emerald-800">You've mastered this sentence!</p>
                   )}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                {feedback === null ? (
                  <button
                    onClick={handleCheck}
                    disabled={!userAnswer.trim()}
                    className="flex-1 bg-stone-900 text-white font-bold py-5 rounded-2xl hover:bg-stone-800 transition shadow-lg active:scale-[0.98] disabled:opacity-30"
                  >
                    Check Translation
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="flex-1 bg-emerald-600 text-white font-bold py-5 rounded-2xl hover:bg-emerald-500 transition shadow-lg shadow-emerald-200 active:scale-[0.98]"
                  >
                    {currentIndex < sentences.length - 1 ? 'Next Sentence' : 'Finish Evaluation'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Card Footer / Stats */}
          <div className="bg-stone-50 border-t border-stone-100 p-6 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Total Attempts</span>
                <span className="text-sm font-bold text-stone-700">{currentStats.total_attempts}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Accuracy</span>
                <span className="text-sm font-bold text-stone-700">
                  {currentStats.total_attempts > 0 ? Math.round((currentStats.correct_count / currentStats.total_attempts) * 100) : 0}%
                </span>
              </div>
            </div>

            <button
              onClick={handleViewHistory}
              className="text-stone-500 hover:text-stone-800 font-bold text-xs flex items-center gap-1.5 transition"
            >
              <svg className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
              {showHistory ? 'Hide History' : 'View Past Mistakes'}
            </button>
          </div>

          {/* History Panel */}
          {showHistory && (
            <div className="bg-white border-t border-stone-100 p-8 animate-in slide-in-from-top duration-300">
               <h5 className="text-sm font-black text-stone-400 uppercase tracking-widest mb-4">Past Attempts</h5>
               {loadingHistory ? (
                 <div className="flex justify-center py-4">
                   <div className="w-6 h-6 border-2 border-stone-200 border-t-emerald-600 rounded-full animate-spin" />
                 </div>
               ) : history.length === 0 ? (
                 <p className="text-stone-400 text-sm italic">No history yet.</p>
               ) : (
                 <div className="space-y-4">
                   {history.map((h, i) => (
                     <div key={h.id} className="flex gap-4">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${h.is_correct ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {h.is_correct ? '✓' : '✕'}
                        </div>
                        <div className="flex-1 min-w-0">
                           {!h.is_correct && h.user_answer && (
                             <p className="text-stone-700 text-sm font-medium mb-1">"{h.user_answer}"</p>
                           )}
                           {h.is_correct && <p className="text-stone-400 text-sm">Correct</p>}
                           <p className="text-stone-400 text-[10px]">{new Date(h.created_at).toLocaleDateString()} · {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
