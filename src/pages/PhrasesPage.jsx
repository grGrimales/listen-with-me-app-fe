import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listPhrasePlaylists, seedDummyPhrasePlaylists, setPhrasePlaylistFavorite } from '../api/phrases'
import PhrasePlaylistShareModal from '../components/PhrasePlaylistShareModal'

const LANG_LABELS = { en: 'English', pt: 'Português' }
const LANG_FLAGS  = { en: '🇺🇸', pt: '🇧🇷' }

export default function PhrasesPage() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [langFilter, setLangFilter] = useState('')
  const [seeding, setSeeding] = useState(false)
  const [sharingPlaylist, setSharingPlaylist] = useState(null)

  useEffect(() => {
    load()
  }, [langFilter, token])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await listPhrasePlaylists(token, langFilter)
      setPlaylists(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleFavorite(p) {
    const next = !p.is_favorite
    // Optimistic update — favorites float to the top, so also resort locally
    setPlaylists(prev => {
      const updated = prev.map(x => x.id === p.id ? { ...x, is_favorite: next } : x)
      return [...updated].sort((a, b) => {
        if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1
        return new Date(b.created_at) - new Date(a.created_at)
      })
    })
    try {
      await setPhrasePlaylistFavorite(p.id, next, token)
    } catch (err) {
      setPlaylists(prev => prev.map(x => x.id === p.id ? { ...x, is_favorite: p.is_favorite } : x))
      alert(err.message)
    }
  }

  async function handleSeed() {
    setSeeding(true)
    try {
      await seedDummyPhrasePlaylists(token)
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setSeeding(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="bg-white border-b border-stone-200 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl">🎧</span>
          <span className="text-emerald-700 text-lg font-bold tracking-tight">Listen With Me</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link to="/" className="text-stone-500 hover:text-stone-800 text-sm font-semibold transition">
            ← Back to Library
          </Link>
          <div className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 transition rounded-xl pl-3 pr-1 py-1">
            <span className="text-sm text-stone-600 font-medium leading-none">{user?.fullName?.split(' ')[0]}</span>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="w-6 h-6 rounded-lg bg-white hover:bg-red-50 hover:text-red-500 text-stone-400 flex items-center justify-center transition shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-stone-800 tracking-tight">💬 Phrases</h2>
            <p className="text-sm text-stone-400 mt-0.5">Pick a playlist to review your phrases</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <Link
              to="/phrases/import"
              className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl px-3 py-2 transition"
            >
              📥 Import JSON
            </Link>
            <Link
              to="/phrases/stats"
              className="text-xs font-bold text-stone-500 hover:text-emerald-700 border border-stone-200 hover:border-emerald-400 rounded-xl px-3 py-2 transition"
            >
              📊 Stats
            </Link>
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="text-xs font-bold text-stone-500 hover:text-emerald-700 border border-stone-200 hover:border-emerald-400 rounded-xl px-3 py-2 transition disabled:opacity-50"
            >
              {seeding ? 'Seeding…' : '+ Seed dummy data'}
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setLangFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${langFilter === '' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-stone-500 border-stone-200 hover:border-emerald-400 hover:text-emerald-700'}`}
          >
            All languages
          </button>
          {['en', 'pt'].map(l => (
            <button
              key={l}
              onClick={() => setLangFilter(l)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${langFilter === l ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-stone-500 border-stone-200 hover:border-emerald-400 hover:text-emerald-700'}`}
            >
              {LANG_FLAGS[l]} {LANG_LABELS[l]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-4"></div>
            <p>Loading playlists...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center">{error}</div>
        ) : playlists.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 flex flex-col items-center justify-center text-center">
            <span className="text-5xl mb-4">💬</span>
            <h3 className="text-xl font-bold text-stone-800 mb-2">No phrase playlists yet</h3>
            <p className="text-stone-500 max-w-md mb-4">
              You don't have any phrase playlists{langFilter ? ` for ${LANG_LABELS[langFilter]}` : ''}.
              Click "Seed dummy data" to create some sample ones.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playlists.map(p => {
              const isOwner = p.role === 'owner'
              return (
              <div
                key={p.id}
                className={`relative bg-white rounded-2xl border p-6 hover:shadow-xl hover:border-emerald-300 transition-all group flex flex-col ${p.is_favorite ? 'border-amber-200 bg-amber-50/30' : 'border-stone-200'}`}
              >
                <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                  {isOwner && (
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setSharingPlaylist(p) }}
                      title="Share playlist"
                      className="text-stone-300 hover:text-emerald-600 transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
                  )}
                  {isOwner && (
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); handleToggleFavorite(p) }}
                      title={p.is_favorite ? 'Remove from favorites' : 'Mark as favorite'}
                      className="transition-transform active:scale-110"
                    >
                      {p.is_favorite
                        ? <svg className="w-6 h-6 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        : <svg className="w-6 h-6 text-stone-300 hover:text-amber-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
                    </button>
                  )}
                </div>
                <Link to={`/phrases/${p.id}`} className="flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-3 pr-16 flex-wrap">
                    <span className="text-3xl">{LANG_FLAGS[p.language] || '🌐'}</span>
                    <span className="bg-stone-100 text-stone-500 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                      {LANG_LABELS[p.language] || p.language}
                    </span>
                    {!isOwner && (
                      <span className="bg-sky-100 text-sky-700 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded" title={`Shared with you (${p.role})`}>
                        🤝 {p.role === 'editor' ? 'Editor' : 'Shared'}
                      </span>
                    )}
                  </div>
                  <h4 className="text-lg font-bold text-stone-800 mb-1 leading-tight group-hover:text-emerald-700 transition-colors">
                    {p.name}
                  </h4>
                  {p.description && (
                    <p className="text-sm text-stone-500 mb-4 line-clamp-2">{p.description}</p>
                  )}
                  <div className="mt-auto flex items-center gap-3 pt-3 border-t border-stone-100">
                    <span className="text-xs text-stone-500 font-semibold">
                      📁 {p.group_count} {p.group_count === 1 ? 'group' : 'groups'}
                    </span>
                    <span className="text-xs text-stone-500 font-semibold">
                      💬 {p.phrase_count} {p.phrase_count === 1 ? 'phrase' : 'phrases'}
                    </span>
                  </div>
                </Link>
              </div>
              )
            })}
          </div>
        )}

        {sharingPlaylist && (
          <PhrasePlaylistShareModal
            playlist={sharingPlaylist}
            onClose={() => setSharingPlaylist(null)}
          />
        )}
      </main>
    </div>
  )
}
