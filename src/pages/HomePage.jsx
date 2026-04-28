import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getStories, deleteStory, getPlaylists, addStoryToPlaylist, removeStoryFromPlaylist } from '../api/stories'

const SORT_OPTIONS = [
  { value: 'least_reviewed', label: 'Menos revisadas' },
  { value: 'last_reviewed',  label: 'Última revisión' },
  { value: 'most_reviewed',  label: 'Más revisadas'  },
  { value: 'newest',         label: 'Más recientes'  },
]

// Searchable playlist combobox
function PlaylistCombobox({ playlists, selectedId, onChange }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)

  const selected = playlists.find(p => p.id === Number(selectedId))
  const displayValue = open ? search : (selected ? selected.name : 'Todas las historias')
  const filtered = playlists.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function select(id) {
    onChange(id)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={ref} className="relative">
      <div
        className={`flex items-center gap-2 border rounded-xl px-3 py-2 bg-white transition-all cursor-text ${open ? 'border-emerald-500 ring-2 ring-emerald-500/10' : 'border-stone-200 hover:border-stone-300'}`}
        onClick={() => { setOpen(true); setSearch(''); setTimeout(() => inputRef.current?.focus(), 0) }}
      >
        {/* queue icon */}
        <svg className="w-4 h-4 text-stone-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h10M4 18h10" />
        </svg>
        <input
          ref={inputRef}
          value={displayValue}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => { setOpen(true); setSearch('') }}
          placeholder="Filtrar playlist..."
          className="flex-1 outline-none text-sm text-stone-700 bg-transparent min-w-0 cursor-pointer"
          readOnly={!open}
        />
        {selectedId && (
          <button
            onClick={e => { e.stopPropagation(); select(null) }}
            className="text-stone-300 hover:text-stone-500 flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <svg className={`w-4 h-4 text-stone-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-xl z-30 overflow-hidden">
          <div className="max-h-56 overflow-y-auto">
            <button
              onClick={() => select(null)}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${!selectedId ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-stone-600 hover:bg-stone-50'}`}
            >
              <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0l-4-4m4 4l-4 4" />
              </svg>
              Todas las historias
            </button>
            {filtered.length === 0 && search && (
              <p className="px-4 py-3 text-sm text-stone-400 italic">Sin resultados para "{search}"</p>
            )}
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => select(p.id)}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors ${Number(selectedId) === p.id ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-stone-600 hover:bg-stone-50'}`}
              >
                <svg className="w-4 h-4 opacity-50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h10M4 18h10" />
                </svg>
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-[10px] bg-stone-100 text-stone-400 px-1.5 py-0.5 rounded-md flex-shrink-0">{p.story_count}</span>
              </button>
            ))}
          </div>
          {playlists.length === 0 && (
            <div className="px-4 py-4 text-center">
              <p className="text-sm text-stone-400 mb-2">No tienes playlists</p>
              <Link to="/playlists" className="text-xs text-emerald-600 font-bold">Crear playlist →</Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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
  const [sortBy, setSortBy] = useState('least_reviewed')

  // Playlist selection state
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [storyToAddToPlaylist, setStoryToAddToPlaylist] = useState(null)
  const [storyToRemove, setStoryToRemove] = useState(null)
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
      setStoryToRemove(null)
      loadStories()
      loadPlaylists()
    } catch (err) {
      alert(err.message)
    }
  }

  const sortedStories = useMemo(() => {
    const arr = [...stories]
    switch (sortBy) {
      case 'least_reviewed':
        // Sin revisión primero, luego por menor cantidad
        return arr.sort((a, b) => a.review_count - b.review_count)
      case 'last_reviewed':
        // La más recientemente revisada primero; las nunca revisadas al final
        return arr.sort((a, b) => {
          if (!a.last_reviewed_at && !b.last_reviewed_at) return 0
          if (!a.last_reviewed_at) return 1
          if (!b.last_reviewed_at) return -1
          return new Date(b.last_reviewed_at) - new Date(a.last_reviewed_at)
        })
      case 'most_reviewed':
        return arr.sort((a, b) => b.review_count - a.review_count)
      case 'newest':
        return arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      default:
        return arr
    }
  }, [stories, sortBy])

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
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h10M4 18h10" />
              </svg>
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h10M4 18h10" />
            </svg>
            Playlists
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
        {/* Filter bar */}
        <div className="mb-8 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex-1 min-w-0">
            <PlaylistCombobox
              playlists={playlists}
              selectedId={playlistId}
              onChange={id => navigate(id ? `/?playlist_id=${id}` : '/')}
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <svg className="w-4 h-4 text-stone-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-700 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all cursor-pointer"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Title + count */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-stone-800 tracking-tight">
            {playlistId ? playlists.find(p => p.id === Number(playlistId))?.name || 'Playlist' : 'Biblioteca'}
          </h2>
          {!loading && (
            <p className="text-sm text-stone-400 mt-0.5">
              {sortedStories.length} {sortedStories.length === 1 ? 'historia' : 'historias'}
              {playlistId && playlists.find(p => p.id === Number(playlistId))?.description && (
                <span className="ml-2 italic">· {playlists.find(p => p.id === Number(playlistId)).description}</span>
              )}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-4"></div>
            <p>Cargando historias...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center">
            {error}
          </div>
        ) : sortedStories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">📚</span>
            <h3 className="text-xl font-bold text-stone-800">Sin historias</h3>
            <p className="text-stone-500 max-w-sm mt-2">
              {playlistId ? 'Esta playlist está vacía.' : 'La biblioteca está vacía.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedStories.map(story => (
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
                    <p className="text-sm text-stone-500 mb-3">By {story.author}</p>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="bg-stone-100 text-stone-600 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                        {story.category?.name || 'General'}
                      </span>
                    </div>
                    {/* Review stats */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          story.review_count === 0
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {story.review_count === 0 ? 'Sin revisar' : `${story.review_count} ${story.review_count === 1 ? 'revisión' : 'revisiones'}`}
                        </span>
                      </div>
                      {story.last_reviewed_at && (
                        <span className="text-[11px] text-stone-400">
                          {formatRelativeDate(story.last_reviewed_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mb-3">
                    <button
                      onClick={() => { setStoryToAddToPlaylist(story); setShowPlaylistModal(true); }}
                      className="w-full bg-stone-100 text-stone-600 text-center py-3 rounded-xl font-bold hover:bg-emerald-50 hover:text-emerald-700 transition shadow-sm flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h10M4 18h10" />
                      </svg>
                      Add to Playlist
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

function formatRelativeDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'hoy'
  if (diffDays === 1) return 'ayer'
  if (diffDays < 7) return `hace ${diffDays} días`
  if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} sem.`
  if (diffDays < 365) return `hace ${Math.floor(diffDays / 30)} meses`
  return `hace ${Math.floor(diffDays / 365)} años`
}
