import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getStories, deleteStory, getPlaylists, addStoryToPlaylist, removeStoryFromPlaylist } from '../api/stories'

export default function HomePage() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const playlistId = searchParams.get('playlist_id')

  const [stories, setStories] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  
  // Playlist selection state
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [storyToAddToPlaylist, setStoryToAddToPlaylist] = useState(null)
  const [storyToRemove, setStoryToRemove] = useState(null) // Nuevo estado
  const [isAddingToPlaylist, setIsAddingToPlaylist] = useState(false)

  const isAdmin = user?.roles?.includes('admin')

  useEffect(() => {
    loadStories()
    loadPlaylists()
  }, [token, playlistId])

  async function loadStories() {
    setLoading(true)
    try {
      const data = await getStories(token, playlistId) // Pass playlistId
      setStories(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadPlaylists() {
    try {
      const data = await getPlaylists(token)
      setPlaylists(data)
    } catch (err) {
      console.error('Error loading playlists:', err)
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

  async function handleAddToPlaylist(pId) {
    if (!storyToAddToPlaylist) return
    setIsAddingToPlaylist(true)
    try {
      await addStoryToPlaylist(pId, storyToAddToPlaylist.id, token)
      setShowPlaylistModal(false)
      setStoryToAddToPlaylist(null)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
      loadPlaylists() // Update counts
    } catch (err) {
      alert(err.message)
    } finally {
      setIsAddingToPlaylist(false)
    }
  }

  async function handleRemoveFromPlaylist() {
    if (!playlistId || !storyToRemove) return
    try {
      await removeStoryFromPlaylist(playlistId, storyToRemove.id, token)
      setStoryToRemove(null) // Cerrar modal
      loadStories()
      loadPlaylists()
    } catch (err) {
      alert(err.message)
    }
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

      {/* Success Notification Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 backdrop-blur-sm bg-emerald-900/10">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xs w-full p-8 animate-in fade-in zoom-in duration-300 text-center border-2 border-emerald-50">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl mb-4 mx-auto">
              ✅
            </div>
            <h3 className="text-2xl font-bold text-stone-800 mb-1">Perfect!</h3>
            <p className="text-stone-500 text-sm font-medium mb-8">Story added to playlist successfully.</p>
            <button
              onClick={() => setShowSuccess(false)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-2xl transition shadow-lg shadow-emerald-200 active:scale-95"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* Remove from Playlist Confirmation Modal */}
      {storyToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-stone-900/30">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center text-3xl mb-6 mx-auto">
              🚫
            </div>
            <h3 className="text-2xl font-bold text-stone-800 text-center mb-2">Remove from Playlist?</h3>
            <p className="text-stone-500 text-center mb-8 font-medium">
              ¿Estás seguro de que quieres quitar <span className="text-stone-800 font-bold">"{storyToRemove.title}"</span> de esta playlist?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleRemoveFromPlaylist}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-2xl transition shadow-lg shadow-red-200"
              >
                Yes, Remove Story
              </button>
              <button
                onClick={() => setStoryToRemove(null)}
                className="w-full bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold py-3 rounded-2xl transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Playlist Modal */}
      {showPlaylistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-stone-900/30">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl mb-6 mx-auto">
              📁
            </div>
            <h3 className="text-2xl font-bold text-stone-800 text-center mb-2">Add to Playlist</h3>
            <p className="text-stone-500 text-center mb-6">
              Select a collection for <span className="text-stone-800 font-bold">"{storyToAddToPlaylist?.title}"</span>
            </p>
            
            <div className="max-h-60 overflow-y-auto mb-6 pr-2 space-y-2">
              {playlists.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-stone-400 mb-4">No playlists found</p>
                  <Link to="/playlists" className="text-emerald-600 font-bold text-sm">Create your first playlist</Link>
                </div>
              ) : (
                playlists.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleAddToPlaylist(p.id)}
                    disabled={isAddingToPlaylist}
                    className="w-full text-left px-4 py-3 rounded-2xl bg-stone-50 hover:bg-emerald-50 hover:text-emerald-700 border border-stone-100 transition font-bold text-stone-700 flex items-center justify-between"
                  >
                    <span>{p.name}</span>
                    <span className="text-[10px] bg-stone-200 text-stone-500 px-2 py-0.5 rounded-full">{p.story_count}</span>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => { setShowPlaylistModal(false); setStoryToAddToPlaylist(null); }}
              className="w-full bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold py-3 rounded-2xl transition"
            >
              Cancel
            </button>
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
          <Link
            to="/stats"
            className="text-stone-500 hover:text-stone-800 text-sm font-semibold transition flex items-center gap-1.5"
          >
            📊 Stats
          </Link>
          <Link
            to="/playlists"
            className="text-stone-500 hover:text-stone-800 text-sm font-semibold transition flex items-center gap-1.5"
          >
            📂 Playlists
          </Link>
          <Link
            to="/zen"
            className="bg-stone-900 hover:bg-stone-700 text-emerald-400 text-sm font-bold px-4 py-2 rounded-xl transition shadow-sm flex items-center gap-1.5"
          >
            🧘 Modo Zen
          </Link>
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
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-stone-800 tracking-tight">
              {playlistId ? `Playlist: ${playlists.find(p => p.id === Number(playlistId))?.name || 'Loading...'}` : 'Library'}
            </h2>
            <p className="text-stone-500">
              {playlistId ? playlists.find(p => p.id === Number(playlistId))?.description : 'Choose a story and start your learning journey.'}
            </p>
          </div>
          {playlistId && (
            <Link to="/" className="text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl hover:bg-emerald-100 transition">
              ✕ Clear Filter
            </Link>
          )}
        </div>

        {/* Playlist Quick Filters */}
        {playlists.length > 0 && (
          <div className="mb-10">
            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 ml-1">Your Collections</h3>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/"
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                  !playlistId 
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-900/10' 
                    : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                }`}
              >
                All Stories
              </Link>
              {playlists.map(p => (
                <Link
                  key={p.id}
                  to={`/?playlist_id=${p.id}`}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all flex items-center gap-2 ${
                    Number(playlistId) === p.id 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-900/10' 
                      : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <span>📁</span>
                  {p.name}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                    Number(playlistId) === p.id ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-400'
                  }`}>
                    {p.story_count}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

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

                  <div className="flex flex-col gap-2 mb-3">
                    <button
                      onClick={() => { setStoryToAddToPlaylist(story); setShowPlaylistModal(true); }}
                      className="w-full bg-stone-100 text-stone-600 text-center py-3 rounded-xl font-bold hover:bg-emerald-50 hover:text-emerald-700 transition shadow-sm flex items-center justify-center gap-2"
                    >
                      <span>📁</span> Add to Playlist
                    </button>
                    
                    {playlistId && (
                      <button
                        onClick={() => setStoryToRemove(story)}
                        className="w-full bg-red-50 text-red-600 text-center py-2 rounded-xl font-bold hover:bg-red-100 transition text-xs"
                      >
                        ✕ Remove from this Playlist
                      </button>
                    )}
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
