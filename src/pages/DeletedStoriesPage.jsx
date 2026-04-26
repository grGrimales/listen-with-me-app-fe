import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getDeletedStories, restoreStory } from '../api/stories'

export default function DeletedStoriesPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadStories()
  }, [token])

  async function loadStories() {
    try {
      setLoading(true)
      const data = await getDeletedStories(token)
      setStories(data)
    } catch (err) {
      console.error('Trash loading error:', err)
      setError(`${err.message} (Endpoint: /api/admin/stories/trash)`)
    } finally {
      setLoading(false)
    }
  }

  async function handleRestore(id) {
    setError('')
    try {
      await restoreStory(id, token)
      setSuccess('Story restored! Redirecting...')
      setTimeout(() => {
        setSuccess('')
        navigate('/')
      }, 2000)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎧</span>
          <span className="text-emerald-700 text-lg font-bold tracking-tight">Listen With Me</span>
        </div>
        <Link to="/" className="text-sm text-stone-500 hover:text-stone-800 transition">
          ← Back to Library
        </Link>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-stone-800 tracking-tight">Trash Bin</h2>
          <p className="text-stone-500">Deleted stories that can be restored.</p>
        </div>

        {success && (
          <div className="mb-6 bg-emerald-100 text-emerald-700 p-4 rounded-xl font-medium">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-6 bg-red-100 text-red-700 p-4 rounded-xl font-medium">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-4"></div>
            <p>Loading deleted stories...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">⚠️</span>
            <h3 className="text-xl font-bold text-stone-800">Failed to load trash</h3>
            <p className="text-stone-500 max-w-sm mt-2">{error}</p>
          </div>
        ) : stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">🗑️</span>
            <h3 className="text-xl font-bold text-stone-800">Trash is empty</h3>
            <p className="text-stone-500 max-w-sm mt-2">
              There are no deleted stories to show.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stories.map(story => (
              <div
                key={story.id}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden opacity-75 grayscale hover:grayscale-0 hover:opacity-100 transition-all group flex flex-col"
              >
                <div className="h-48 bg-stone-200 relative overflow-hidden">
                  {story.cover_url ? (
                    <img
                      src={story.cover_url}
                      alt={story.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl bg-stone-100">
                      📖
                    </div>
                  )}
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-stone-800 mb-1 leading-tight">
                      {story.title}
                    </h4>
                    <p className="text-sm text-stone-500 mb-4">By {story.author}</p>
                  </div>

                  <button
                    onClick={() => handleRestore(story.id)}
                    className="w-full bg-emerald-600 text-white text-center py-3 rounded-xl font-semibold hover:bg-emerald-500 transition shadow-sm"
                  >
                    Restore Story
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
