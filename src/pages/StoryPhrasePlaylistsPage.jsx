import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listStoryPhrasePlaylists } from '../api/stories'

const LANG_FLAGS = { en: '🇺🇸', pt: '🇧🇷' }

export default function StoryPhrasePlaylistsPage() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    listStoryPhrasePlaylists(token)
      .then(setPlaylists)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

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
          <Link to="/phrases" className="text-stone-500 hover:text-stone-800 text-sm font-semibold transition">
            💬 Phrase Playlists
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
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-stone-800 tracking-tight">📖 Words from Story Playlists</h2>
          <p className="text-sm text-stone-400 mt-0.5">
            One word playlist per story playlist. Their audio is the story's own narration — no new audio is generated.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-4"></div>
            <p>Loading...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center">{error}</div>
        ) : playlists.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 flex flex-col items-center justify-center text-center">
            <span className="text-5xl mb-4">📖</span>
            <h3 className="text-xl font-bold text-stone-800 mb-2">No saved words yet</h3>
            <p className="text-stone-500 max-w-md">
              Add a story to one of your story playlists, then open it, select a word and save it.
              It will appear here as a reviewable playlist that plays the story's own audio.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playlists.map(p => (
              <Link
                key={p.id}
                to={`/phrases/${p.id}`}
                className="bg-white rounded-2xl border border-stone-200 p-6 hover:shadow-xl hover:border-emerald-300 transition-all group flex flex-col"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-3xl">{LANG_FLAGS[p.language] || '🌐'}</span>
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                    📖 Story Playlist
                  </span>
                </div>
                <h4 className="text-lg font-bold text-stone-800 mb-1 leading-tight group-hover:text-emerald-700 transition-colors">
                  {p.story_playlist_name}
                </h4>
                <div className="mt-auto flex items-center gap-3 pt-3 border-t border-stone-100">
                  <span className="text-xs text-stone-500 font-semibold">
                    💬 {p.phrase_count} {p.phrase_count === 1 ? 'word' : 'words'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
