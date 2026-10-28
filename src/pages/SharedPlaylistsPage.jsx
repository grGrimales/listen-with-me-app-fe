import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listPhrasePlaylists } from '../api/phrases'

const LANG_FLAGS = { en: '🇺🇸', pt: '🇧🇷' }

// The only home a "shared" user gets: the phrase playlists shared with them (with their
// 📗 Vocab child underneath), each with review, relax (zen) and exam. For the owner it
// is a preview listing the playlists they have shared with someone.
export default function SharedPlaylistsPage() {
  const { user, token, logout, sharedOnly } = useAuth()
  const navigate = useNavigate()
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    listPhrasePlaylists(token, undefined, { includeVocab: true })
      .then(setPlaylists)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  // [{ playlist, vocab: [child…] }]: a vocab child sits under its parent when both are visible.
  const cards = useMemo(() => {
    const visible = sharedOnly
      ? playlists
      : playlists.filter(p => p.role === 'owner' && p.is_shared)
    const ids = new Set(visible.map(p => p.id))
    const childrenOf = {}
    visible.forEach(p => {
      if (p.parent_playlist_id && ids.has(p.parent_playlist_id)) {
        (childrenOf[p.parent_playlist_id] ||= []).push(p)
      }
    })
    return visible
      .filter(p => !p.parent_playlist_id || !ids.has(p.parent_playlist_id))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .map(p => ({ playlist: p, vocab: childrenOf[p.id] || [] }))
  }, [playlists, sharedOnly])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="bg-white border-b border-stone-200 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20 gap-3">
        <Link to="/compartidos" className="flex items-center gap-2 min-w-0">
          <span className="text-2xl">🎧</span>
          <span className="text-emerald-700 text-lg font-bold tracking-tight truncate">Listen With Me</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {!sharedOnly && (
            <Link to="/phrases" className="hidden sm:inline text-stone-500 hover:text-stone-800 text-sm font-semibold transition">
              ← Phrases
            </Link>
          )}
          <Link
            to="/phrases/stats"
            title="Tus estadísticas de repaso (las de relax están en Relax → Stats)"
            className="text-xs font-bold text-stone-500 hover:text-emerald-700 border border-stone-200 hover:border-emerald-400 rounded-xl px-3 py-2 transition"
          >
            📊 Estadísticas
          </Link>
          <Link
            to="/search"
            className="text-xs font-bold text-stone-500 hover:text-amber-700 border border-stone-200 hover:border-amber-400 rounded-xl px-3 py-2 transition"
          >
            🔎 Buscar
          </Link>
          <div className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 transition rounded-xl pl-3 pr-1 py-1">
            <span className="hidden sm:inline text-sm text-stone-600 font-medium leading-none">{user?.fullName?.split(' ')[0]}</span>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="w-6 h-6 rounded-lg bg-white hover:bg-red-50 hover:text-red-500 text-stone-400 flex items-center justify-center transition shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-stone-800 tracking-tight">Mis playlists</h2>
          <p className="text-sm text-stone-400 mt-0.5">
            {sharedOnly
              ? 'Repasa las frases, escúchalas en modo relax o ponte a prueba.'
              : 'Vista previa: así ven tus playlists compartidos las personas con el rol "shared".'}
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-4"></div>
            <p>Cargando…</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center">{error}</div>
        ) : cards.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
            <span className="text-5xl mb-4 block">🤝</span>
            <p className="text-stone-500">
              {sharedOnly
                ? 'Todavía no tienes playlists compartidos.'
                : 'Aún no compartes ningún playlist. Compártelo desde /phrases y aparecerá aquí.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards.map(({ playlist, vocab }) => (
              <div key={playlist.id} className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col gap-4">
                <PlaylistRow p={playlist} />
                {vocab.map(v => (
                  <div key={v.id} className="border-t border-stone-100 pt-4">
                    <PlaylistRow p={v} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function PlaylistRow({ p }) {
  const isVocab = !!p.parent_playlist_id
  return (
    <div>
      <div className="flex items-start gap-2 mb-3">
        {!isVocab && <span className="text-xl leading-none">{LANG_FLAGS[p.language] || '🌐'}</span>}
        <div className="min-w-0">
          <h3 className="font-bold text-stone-800 leading-tight">{p.name}</h3>
          <p className="text-xs text-stone-400 mt-0.5">
            {p.phrase_count} {isVocab ? (p.phrase_count === 1 ? 'palabra' : 'palabras') : (p.phrase_count === 1 ? 'frase' : 'frases')}
            {' · '}{p.group_count} {p.group_count === 1 ? 'grupo' : 'grupos'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Link
          to={`/phrases/${p.id}`}
          className="text-center text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl px-2 py-2 transition"
        >
          🔁 Repasar
        </Link>
        <Link
          to={`/phrases/zen?playlist=${p.id}`}
          className="text-center text-xs font-bold text-stone-600 hover:text-emerald-700 border border-stone-200 hover:border-emerald-400 rounded-xl px-2 py-2 transition"
        >
          🧘 Relax
        </Link>
        <Link
          to={`/phrases/${p.id}/evaluation`}
          className="text-center text-xs font-bold text-stone-600 hover:text-indigo-700 border border-stone-200 hover:border-indigo-400 rounded-xl px-2 py-2 transition"
        >
          ✍️ Examen
        </Link>
      </div>
    </div>
  )
}
