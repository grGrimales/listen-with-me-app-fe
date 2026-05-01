import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getPlaylists, createPlaylist, updatePlaylist, deletePlaylist, setPlaylistFavorite } from '../api/stories'

export default function PlaylistsPage() {
  const { token } = useAuth()
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  
  // Form state
  const [editingId, setEditingId] = useState(null)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Delete modal state
  const [playlistToDelete, setPlaylistToDelete] = useState(null)

  useEffect(() => {
    load()
  }, [token])

  async function load() {
    try {
      const data = await getPlaylists(token)
      setPlaylists(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditingId(null)
    setNewName('')
    setNewDesc('')
    setShowForm(true)
  }

  function openEdit(p) {
    setEditingId(p.id)
    setNewName(p.name)
    setNewDesc(p.description)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setNewName('')
    setNewDesc('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setIsSaving(true)
    try {
      if (editingId) {
        await updatePlaylist(editingId, { name: newName, description: newDesc }, token)
      } else {
        await createPlaylist({ name: newName, description: newDesc }, token)
      }
      closeForm()
      load()
    } catch (err) {
      alert(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!playlistToDelete) return
    try {
      await deletePlaylist(playlistToDelete.id, token)
      setPlaylistToDelete(null)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleToggleFavorite(p) {
    const next = !p.is_favorite
    // Optimistic update
    setPlaylists(prev => prev.map(x => x.id === p.id ? { ...x, is_favorite: next } : x))
    try {
      await setPlaylistFavorite(p.id, next, token)
    } catch (err) {
      // Revert on error
      setPlaylists(prev => prev.map(x => x.id === p.id ? { ...x, is_favorite: p.is_favorite } : x))
      alert(err.message)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
    </div>
  )

  return (
    <div className="min-h-screen bg-stone-50 pb-20 relative">
      {/* Delete Playlist Confirmation Modal */}
      {playlistToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-sm bg-stone-900/30">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center text-3xl mb-6 mx-auto">
              🗑️
            </div>
            <h3 className="text-2xl font-bold text-stone-800 text-center mb-2">Delete Playlist?</h3>
            <p className="text-stone-500 text-center mb-8 font-medium">
              ¿Eliminar <span className="text-stone-800 font-bold">"{playlistToDelete.name}"</span>? Las historias no se borrarán, solo la colección.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleDelete}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-2xl transition shadow-lg shadow-red-200"
              >
                Yes, Delete Playlist
              </button>
              <button
                onClick={() => setPlaylistToDelete(null)}
                className="w-full bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold py-3 rounded-2xl transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-stone-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-stone-500 hover:text-stone-800 transition font-medium">← Library</Link>
          <h1 className="text-lg font-bold text-stone-800 text-center flex-1">My Playlists</h1>
          <button 
            onClick={openCreate}
            className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-emerald-500 transition shadow-sm"
          >
            + New List
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {showForm && (
          <div className="bg-white rounded-[2rem] border border-stone-200 p-8 shadow-sm mb-10 animate-in fade-in slide-in-from-top-4 duration-300">
            <h3 className="text-xl font-bold text-stone-800 mb-6">
              {editingId ? 'Edit Playlist' : 'Create New Playlist'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                  placeholder="e.g. Daily Practice"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5 ml-1">Description (Optional)</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none min-h-[100px]"
                  placeholder="What's this collection about?"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-2xl hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/10"
                >
                  {isSaving ? 'Saving...' : editingId ? 'Update Playlist' : 'Create Playlist'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-6 bg-stone-100 text-stone-600 font-bold py-3 rounded-2xl hover:bg-stone-200 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {playlists.length === 0 ? (
          <div className="py-20 text-center">
            <span className="text-6xl mb-6 block">📂</span>
            <h3 className="text-2xl font-bold text-stone-800 mb-2">No playlists yet</h3>
            <p className="text-stone-500 max-w-sm mx-auto mb-8">
              Create collections to organize your favorite stories.
            </p>
            {!showForm && (
              <button 
                onClick={openCreate}
                className="bg-white border border-stone-200 text-emerald-600 font-bold px-8 py-3 rounded-2xl hover:border-emerald-600 transition shadow-sm"
              >
                Create your first playlist
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playlists.map(p => (
              <div key={p.id} className={`bg-white rounded-[2rem] border p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col group ${p.is_favorite ? 'border-amber-200 bg-amber-50/30' : 'border-stone-200'}`}>
                <div className="flex-1 mb-6">
                  <div className="flex items-start justify-between mb-2">
                    <button
                      onClick={() => handleToggleFavorite(p)}
                      title={p.is_favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
                      className="transition-transform active:scale-110"
                    >
                      {p.is_favorite
                        ? <svg className="w-7 h-7 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        : <svg className="w-7 h-7 text-stone-300 hover:text-amber-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      }
                    </button>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-stone-300 hover:text-emerald-600 transition p-1"
                        title="Edit name"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button
                        onClick={() => setPlaylistToDelete(p)}
                        className="text-stone-300 hover:text-red-500 transition p-1"
                        title="Delete playlist"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                  <h4 className="text-xl font-bold text-stone-800 mb-1">{p.name}</h4>
                  <p className="text-sm text-stone-500 line-clamp-2">{p.description || 'No description'}</p>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                  <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-tighter">
                    {p.story_count} {p.story_count === 1 ? 'story' : 'stories'}
                  </span>
                  <Link 
                    to={`/?playlist_id=${p.id}`}
                    className="text-xs font-bold text-stone-400 hover:text-stone-800 transition flex items-center gap-1"
                  >
                    View Stories →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
