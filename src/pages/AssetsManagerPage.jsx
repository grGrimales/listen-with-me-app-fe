import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getStory, updateStory } from '../api/stories'

export default function AssetsManagerPage() {
  const { id } = useParams()
  const { token } = useAuth()
  const navigate = useNavigate()
  const [story, setStory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadStory()
  }, [id])

  async function loadStory() {
    try {
      const data = await getStory(id, token)
      setStory(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateMetadata(e) {
    e.preventDefault()
    setSuccess('')
    const formData = new FormData(e.target)
    const updated = {
      ...story,
      title: formData.get('title'),
      level: formData.get('level'),
      author: formData.get('author'),
      cover_url: formData.get('cover_url'),
      category_id: parseInt(formData.get('category_id')),
      // Keep paragraphs as they are for this form
      paragraphs: story.paragraphs.map(p => ({
        ...p,
        translations: p.translations.map(t => ({ language: t.language, content: t.content })),
        vocabulary: p.vocabulary.map(v => ({ word: v.word, definition: v.definition }))
      }))
    }

    try {
      await updateStory(id, updated, token)
      setSuccess('Metadata updated successfully!')
      loadStory()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleUpdateParagraphImage(pId, imageUrl) {
    // This is a simplified version that updates the whole story
    const updated = {
      ...story,
      paragraphs: story.paragraphs.map(p => {
        if (p.id === pId) return { ...p, image_url: imageUrl }
        return p
      }).map(p => ({
        ...p,
        translations: p.translations.map(t => ({ language: t.language, content: t.content })),
        vocabulary: p.vocabulary.map(v => ({ word: v.word, definition: v.definition }))
      }))
    }
    try {
      await updateStory(id, updated, token)
      setSuccess('Image updated!')
      loadStory()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="p-10 text-center">Loading...</div>

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-stone-800">Assets Manager</h1>
            <p className="text-stone-500">Manage images and metadata for "{story.title}"</p>
          </div>
          <Link to="/" className="text-emerald-600 font-medium">← Back</Link>
        </header>

        {success && <div className="mb-6 bg-emerald-100 text-emerald-700 p-4 rounded-xl font-medium">{success}</div>}
        {error && <div className="mb-6 bg-red-100 text-red-700 p-4 rounded-xl font-medium">{error}</div>}

        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 mb-8">
          <h2 className="text-xl font-bold text-stone-800 mb-6">Main Assets</h2>
          <form onSubmit={handleUpdateMetadata} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-stone-700 mb-1">Story Title</label>
              <input name="title" defaultValue={story.title} className="w-full border border-stone-300 rounded-xl px-4 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Author</label>
              <input name="author" defaultValue={story.author} className="w-full border border-stone-300 rounded-xl px-4 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Level</label>
              <select name="level" defaultValue={story.level} className="w-full border border-stone-300 rounded-xl px-4 py-2">
                {['A1','A2','B1','B2','C1','C2'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
             <div className="md:col-span-2">
              <label className="block text-sm font-medium text-stone-700 mb-1">Cover Image URL</label>
              <input name="cover_url" defaultValue={story.cover_url} className="w-full border border-stone-300 rounded-xl px-4 py-2" placeholder="https://..." />
            </div>
            <input type="hidden" name="category_id" value={story.category_id} />
            <div className="md:col-span-2">
              <button type="submit" className="bg-stone-800 text-white px-6 py-2 rounded-xl hover:bg-stone-700 transition">
                Update Metadata
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-bold text-stone-800 mb-4">Paragraph Images</h2>
          {story.paragraphs.map((p, i) => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 flex gap-6">
              <div className="w-32 h-32 bg-stone-100 rounded-xl overflow-hidden flex-shrink-0">
                {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-stone-300">No image</div>}
              </div>
              <div className="flex-1">
                <p className="text-sm text-stone-500 mb-3 line-clamp-2">"{p.content}"</p>
                <div className="flex gap-2">
                  <input
                    id={`img-${p.id}`}
                    placeholder="Image URL..."
                    defaultValue={p.image_url}
                    className="flex-1 border border-stone-300 rounded-xl px-4 py-2 text-sm"
                  />
                  <button
                    onClick={() => handleUpdateParagraphImage(p.id, document.getElementById(`img-${p.id}`).value)}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-emerald-500 transition"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
