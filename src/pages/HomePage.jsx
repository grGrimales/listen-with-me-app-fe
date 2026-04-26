import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getStories, deleteStory } from '../api/stories'

export default function HomePage() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const isAdmin = user?.roles?.includes('admin')

  useEffect(() => {
    loadStories()
  }, [token])

  async function loadStories() {
    try {
      const data = await getStories(token)
      setStories(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function confirmDelete() {
    if (!deletingId) return
    try {
      await deleteStory(deletingId, token)
      setDeletingId(null)
      await loadStories()
      // Optional: navigate to trash to see it there
      navigate('/admin/stories/trash')
    } catch (err) {
      alert(err.message)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col relative">
      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-stone-900/30">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center text-3xl mb-6 mx-auto">
              🗑️
            </div>
            <h3 className="text-2xl font-bold text-stone-800 text-center mb-2">Delete Story?</h3>
            <p className="text-stone-500 text-center mb-8">
              This action cannot be undone. All paragraphs, translations and progress will be lost.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmDelete}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-2xl transition shadow-lg shadow-red-200"
              >
                Yes, Delete Story
              </button>
              <button
                onClick={() => setDeletingId(null)}
                className="w-full bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold py-3 rounded-2xl transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎧</span>
          <span className="text-emerald-700 text-lg font-bold tracking-tight">Listen With Me</span>
        </div>
        <div className="flex items-center gap-5">
          {isAdmin && (
            <>
              <Link
                to="/admin/stories/trash"
                className="text-stone-500 hover:text-stone-800 text-sm font-semibold transition"
              >
                🗑️ Trash
              </Link>
              <Link
                to="/admin/stories/create"
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shadow-sm"
              >
                + Create Story
              </Link>
            </>
          )}
          <span className="text-sm text-stone-500 hidden sm:block">
            Hi, <span className="text-stone-700 font-medium">{user?.fullName}</span>
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-stone-500 hover:text-stone-800 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-stone-800 tracking-tight">Library</h2>
          <p className="text-stone-500">Choose a story and start your learning journey.</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-4"></div>
            <p>Loading stories...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center">
            {error}
          </div>
        ) : stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">📚</span>
            <h3 className="text-xl font-bold text-stone-800">No stories yet</h3>
            <p className="text-stone-500 max-w-sm mt-2">
              Our library is currently empty. Check back later or create one if you are an admin.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stories.map(story => (
              <div
                key={story.id}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-xl transition-shadow group flex flex-col"
              >
                <div className="h-48 bg-stone-200 relative overflow-hidden">
                  {story.cover_url ? (
                    <img
                      src={story.cover_url}
                      alt={story.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-emerald-100 to-amber-100">
                      📖
                    </div>
                  )}
                  <div className="absolute top-4 left-4">
                    <span className="bg-white/90 backdrop-blur-sm text-emerald-700 text-xs font-bold px-2 py-1 rounded shadow-sm">
                      {story.level}
                    </span>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-stone-800 mb-1 leading-tight group-hover:text-emerald-700 transition-colors">
                      {story.title}
                    </h4>
                    <p className="text-sm text-stone-500 mb-4">By {story.author}</p>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="bg-stone-100 text-stone-600 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                        {story.category?.name || 'General'}
                      </span>
                    </div>
                  </div>

                  <Link
                    to={`/stories/${story.id}`}
                    className="w-full bg-stone-800 text-white text-center py-3 rounded-xl font-semibold hover:bg-stone-700 transition shadow-sm mb-3"
                  >
                    Read & Listen
                  </Link>

                  {isAdmin && (
                    <div className="grid grid-cols-3 gap-2">
                      <Link
                        to={`/admin/stories/${story.id}/edit`}
                        className="bg-stone-100 text-stone-600 text-xs font-bold py-2 rounded-lg hover:bg-stone-200 transition text-center"
                      >
                        JSON
                      </Link>
                      <Link
                        to={`/admin/stories/${story.id}/assets`}
                        className="bg-emerald-50 text-emerald-700 text-xs font-bold py-2 rounded-lg hover:bg-emerald-100 transition text-center"
                      >
                        Assets
                      </Link>
                      <button
                        onClick={() => setDeletingId(story.id)}
                        className="bg-red-50 text-red-600 text-xs font-bold py-2 rounded-lg hover:bg-red-100 transition"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
