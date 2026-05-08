import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  getStory, 
  getStorySentences, 
  previewSentences, 
  saveSentences 
} from '../api/stories'

export default function AdminSentenceManagerPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token, user } = useAuth()
  
  const [story, setStory] = useState(null)
  const [sentences, setSentences] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!user?.roles?.includes('admin')) {
      navigate('/')
      return
    }
    async function load() {
      try {
        const [storyData, sentenceData] = await Promise.all([
          getStory(id, token),
          getStorySentences(id, token).catch(() => [])
        ])
        setStory(storyData)
        setSentences(Array.isArray(sentenceData) ? sentenceData : [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, token, user, navigate])

  const handlePreview = async () => {
    setGenerating(true)
    setError('')
    setSuccess('')
    try {
      const data = await previewSentences(id, token)
      setSentences(Array.isArray(data) ? data.map((s, i) => ({ ...s, id: `new-${i}` })) : [])
      setSuccess('Sentences generated with Gemini! Please review them below.')
    } catch (err) {
      setError("Failed to generate: " + err.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!validateSentences()) return
    
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const cleaned = sentences.map(({ en, es }) => ({ en, es }))
      await saveSentences(id, cleaned, token)
      setSuccess('Sentences saved successfully!')
    } catch (err) {
      setError("Failed to save: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  const validateSentences = () => {
    return true
  }

  const updateSentence = (index, field, value) => {
    const next = [...sentences]
    next[index][field] = value
    setSentences(next)
  }

  const removeSentence = (index) => {
    setSentences(sentences.filter((_, i) => i !== index))
  }

  const addSentence = (index) => {
    const next = [...sentences]
    next.splice(index + 1, 0, { en: '', es: '', id: Date.now() })
    setSentences(next)
  }

  if (loading) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
    </div>
  )

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      <header className="bg-white border-b border-stone-200 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/stories/${id}`} className="text-stone-500 hover:text-stone-800 transition">← Back</Link>
            <h1 className="font-bold text-stone-800">Manage Sentences: {story?.title}</h1>
          </div>
          <div className="flex items-center gap-3">
             <button
               onClick={handlePreview}
               disabled={generating || saving}
               className="bg-stone-100 text-stone-700 px-4 py-2 rounded-xl font-bold hover:bg-stone-200 transition disabled:opacity-50 text-sm"
             >
               {generating ? 'Generating...' : 'Regenerate with Gemini'}
             </button>
             <button
               onClick={handleSave}
               disabled={generating || saving || sentences.length === 0}
               className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-200 disabled:opacity-50 text-sm"
             >
               {saving ? 'Saving...' : 'Save All Sentences'}
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Story Reference */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-3xl border border-stone-200 sticky top-24">
            <h2 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4">Original Story Content</h2>
            <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {story?.paragraphs.map((p, i) => (
                <div key={i} className="mb-4">
                  <span className="text-[10px] font-mono text-stone-300">P{i+1}</span>
                  <p className="text-sm text-stone-600 leading-relaxed">{p.content}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-stone-100">
               <p className="text-[10px] text-stone-400 font-medium leading-tight">
                 Verify that the English sentences are correct and the translations are accurate before saving.
               </p>
            </div>
          </div>
        </div>

        {/* Sentences Editor */}
        <div className="lg:col-span-2">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl mb-6 text-sm font-medium">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-4 rounded-2xl mb-6 text-sm font-medium">
              {success}
            </div>
          )}

          {sentences.length === 0 ? (
            <div className="bg-white rounded-3xl border-2 border-dashed border-stone-200 p-20 text-center">
               <p className="text-4xl mb-4">🧩</p>
               <h3 className="text-xl font-bold text-stone-800 mb-2">No sentences yet</h3>
               <p className="text-stone-500 mb-8">Click the button above to let Gemini split the story into sentences automatically.</p>
               <button
                 onClick={handlePreview}
                 className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-500 transition"
               >
                 Start Splitting with AI
               </button>
            </div>
          ) : (
            <div className="space-y-4">
              {sentences.map((s, i) => (
                <div key={s.id || i} className="group bg-white rounded-3xl border border-stone-200 p-6 transition-all hover:border-emerald-200 hover:shadow-sm">
                   <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center gap-2">
                         <span className="w-8 h-8 rounded-full bg-stone-100 text-stone-400 text-xs font-bold flex items-center justify-center">
                            {i + 1}
                         </span>
                         <button 
                           onClick={() => removeSentence(i)}
                           className="text-stone-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                           title="Remove"
                         >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                         </button>
                      </div>

                      <div className="flex-1 space-y-4">
                         <div>
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1 block">English</label>
                            <textarea
                              value={s.en}
                              onChange={(e) => updateSentence(i, 'en', e.target.value)}
                              className="w-full bg-stone-50 border border-stone-100 rounded-xl p-3 text-sm font-medium focus:bg-white focus:border-emerald-500 focus:outline-none resize-none"
                              rows={2}
                            />
                         </div>
                         <div>
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1 block">Spanish</label>
                            <textarea
                              value={s.es}
                              onChange={(e) => updateSentence(i, 'es', e.target.value)}
                              className="w-full bg-stone-50 border border-stone-100 rounded-xl p-3 text-sm italic focus:bg-white focus:border-emerald-500 focus:outline-none resize-none"
                              rows={2}
                            />
                         </div>
                      </div>
                   </div>
                   
                   <div className="mt-4 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => addSentence(i)}
                        className="bg-stone-50 text-stone-400 text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full hover:bg-emerald-50 hover:text-emerald-600 transition"
                      >
                        + Insert Sentence Below
                      </button>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
