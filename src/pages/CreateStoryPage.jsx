import { useState, useEffect } from 'react'
import { useNavigate, Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getStory, updateStory } from '../api/stories'

export default function CreateStoryPage() {
  const { id } = useParams()
  const isEdit = !!id
  const { token } = useAuth()
  const navigate = useNavigate()
  const [jsonInput, setJsonInput] = useState(JSON.stringify(defaultStory, null, 2))
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (isEdit) {
      loadStoryForEdit()
    }
  }, [id])

  async function loadStoryForEdit() {
    setLoading(true)
    try {
      const story = await getStory(id, token)
      // Transform story to matching request structure
      const editData = {
        title: story.title,
        level: story.level,
        category_id: story.category_id,
        cover_url: story.cover_url,
        author: story.author,
        paragraphs: story.paragraphs.map(p => ({
          position: p.position,
          content: p.content,
          image_url: p.image_url,
          translations: p.translations.map(t => ({ language: t.language, content: t.content })),
          vocabulary: p.vocabulary.map(v => ({ word: v.word, definition: v.definition }))
        })),
        voices: story.voices?.map(v => ({
          name: v.name,
          audio_url: v.audio_url,
          timestamps: v.timestamps.map(ts => ({
            paragraph_id: ts.paragraph_id,
            start_ms: ts.start_ms,
            end_ms: ts.end_ms
          }))
        })) || []
      }
      setJsonInput(JSON.stringify(editData, null, 2))
      setPreview(editData)
    } catch (err) {
      setError('Failed to load story: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function handlePreview() {
    setError('')
    setSuccess(false)
    try {
      const parsed = JSON.parse(jsonInput)
      setPreview(parsed)
    } catch (err) {
      setError('Invalid JSON format: ' + err.message)
      setPreview(null)
    }
  }

  async function handleSave() {
    setError('')
    setSuccess(false)
    setLoading(true)
    try {
      const storyData = JSON.parse(jsonInput)
      let res;
      if (isEdit) {
        await updateStory(id, storyData, token)
      } else {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8082'}/api/stories/full`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(storyData)
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to create story')
        }
      }

      setSuccess(true)
      setTimeout(() => {
        navigate('/')
      }, 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-7xl mx-auto">
        {success && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-bounce">
            <div className="bg-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-emerald-400">
              <span className="text-2xl">✨</span>
              <span className="font-bold">Story {isEdit ? 'updated' : 'created'} beautifully!</span>
            </div>
          </div>
        )}
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-stone-800">{isEdit ? 'Edit Story' : 'Create Story'} from JSON</h1>
            <p className="text-stone-500">Paste your story structure below to preview and {isEdit ? 'update' : 'import'}.</p>
          </div>
          <Link to="/" className="text-stone-500 hover:text-stone-800 font-medium text-sm transition">
            ← Back to Home
          </Link>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Editor Section */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden flex flex-col h-[600px]">
              <div className="bg-stone-100 px-4 py-2 border-b border-stone-200 flex justify-between items-center">
                <span className="text-sm font-medium text-stone-600">JSON Editor</span>
                {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
              </div>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="flex-1 p-4 font-mono text-sm focus:outline-none resize-none"
                spellCheck="false"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePreview}
                className="flex-1 bg-stone-800 text-white font-semibold py-3 rounded-xl hover:bg-stone-700 transition"
              >
                Preview Story
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !preview}
                className="flex-1 bg-emerald-600 text-white font-semibold py-3 rounded-xl hover:bg-emerald-500 disabled:opacity-50 transition"
              >
                {loading ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update Story' : 'Create Story')}
              </button>
            </div>
          </div>

          {/* Preview Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden flex flex-col h-[600px]">
            <div className="bg-stone-100 px-4 py-2 border-b border-stone-200">
              <span className="text-sm font-medium text-stone-600">Live Preview</span>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              {!preview ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-400">
                  <span className="text-4xl mb-2">👁️</span>
                  <p>Click "Preview Story" to see it here</p>
                </div>
              ) : (
                <article className="prose prose-stone max-w-none">
                  <div className="mb-8">
                    <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider mb-2">
                      Level {preview.level}
                    </span>
                    <h2 className="text-4xl font-bold text-stone-900 mt-0">{preview.title}</h2>
                    <p className="text-stone-500 italic">By {preview.author}</p>
                  </div>

                  {preview.paragraphs?.map((p, idx) => (
                    <div key={idx} className="mb-10 pb-6 border-b border-stone-100 last:border-0">
                      <p className="text-xl leading-relaxed text-stone-800 mb-4">{p.content}</p>
                      <div className="bg-stone-50 rounded-xl p-4">
                        <h4 className="text-xs font-bold text-stone-400 uppercase mb-2">Translation</h4>
                        {p.translations?.map((t, tidx) => (
                          <p key={tidx} className="text-stone-600 italic">{t.content}</p>
                        ))}
                      </div>
                      {p.vocabulary?.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {p.vocabulary.map((v, vidx) => (
                            <span key={vidx} className="bg-white border border-stone-200 px-3 py-1 rounded-full text-sm">
                              <strong className="text-emerald-700">{v.word}</strong>: {v.definition}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </article>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const defaultStory = {
  title: "The Silent Forest",
  level: "B1",
  category_id: 1,
  cover_url: "",
  author: "J.R. Smith",
  paragraphs: [
    {
      position: 1,
      content: "Deep in the heart of the mountains, there was a forest where no birds sang.",
      image_url: "",
      translations: [
        { language: "es", content: "En lo profundo del corazón de las montañas, había un bosque donde ningún pájaro cantaba." }
      ],
      vocabulary: [
        { word: "Deep", definition: "At a great depth" },
        { word: "Heart", definition: "The central or innermost part" }
      ]
    }
  ]
}
