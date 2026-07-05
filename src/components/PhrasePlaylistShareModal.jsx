import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  listPlaylistShares,
  addPlaylistShare,
  updatePlaylistShare,
  removePlaylistShare,
  searchShareCandidates,
} from '../api/phrases'

export default function PhrasePlaylistShareModal({ playlist, onClose }) {
  const { token } = useAuth()
  const [shares, setShares] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [permission, setPermission] = useState('read')
  const [adding, setAdding] = useState(false)
  const searchBoxRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    listPlaylistShares(playlist.id, token)
      .then(setShares)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [playlist.id, token])

  // Close suggestions dropdown when clicking outside the search box
  useEffect(() => {
    function onOutside(e) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setSuggestionsOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // Debounced search — triggers on query change
  useEffect(() => {
    if (selected) return
    const q = query.trim()
    if (q.length < 2) {
      setSuggestions([])
      setSearching(false)
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const results = await searchShareCandidates(playlist.id, q, token)
        setSuggestions(results)
      } catch (err) {
        console.error('searchShareCandidates:', err)
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query, selected, playlist.id, token])

  function pickSuggestion(u) {
    setSelected(u)
    setQuery('')
    setSuggestions([])
    setSuggestionsOpen(false)
    setError('')
  }

  function clearSelected() {
    setSelected(null)
    setQuery('')
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!selected) return
    setAdding(true)
    setError('')
    try {
      const created = await addPlaylistShare(playlist.id, selected.email, permission, token)
      setShares(prev => {
        const other = prev.filter(s => s.user_id !== created.user_id)
        return [created, ...other]
      })
      setSelected(null)
      setQuery('')
      setPermission('read')
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleChangePermission(userId, nextPermission) {
    const prev = shares
    setShares(shares.map(s => s.user_id === userId ? { ...s, permission: nextPermission } : s))
    try {
      await updatePlaylistShare(playlist.id, userId, nextPermission, token)
    } catch (err) {
      setShares(prev)
      alert(err.message)
    }
  }

  async function handleRemove(userId) {
    const prev = shares
    setShares(shares.filter(s => s.user_id !== userId))
    try {
      await removePlaylistShare(playlist.id, userId, token)
    } catch (err) {
      setShares(prev)
      alert(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-stone-900/30" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-stone-800 mb-1">Share playlist</h3>
            <p className="text-sm text-stone-500 truncate max-w-[16rem]" title={playlist.name}>{playlist.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 transition"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Add form */}
        <form onSubmit={handleAdd} className="mb-6 flex flex-col gap-2">
          <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Invite a user</label>

          {selected ? (
            <div className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 rounded-xl px-3 py-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                {selected.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-stone-800 truncate">{selected.full_name}</p>
                <p className="text-[11px] text-stone-500 truncate">{selected.email}</p>
              </div>
              <button
                type="button"
                onClick={clearSelected}
                title="Choose someone else"
                className="text-stone-400 hover:text-red-500 transition flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div ref={searchBoxRef} className="relative">
              <input
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setSuggestionsOpen(true) }}
                onFocus={() => setSuggestionsOpen(true)}
                placeholder="Search by name or email (min. 2 chars)"
                autoComplete="off"
                className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
              />
              {suggestionsOpen && query.trim().length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-xl z-20 overflow-hidden">
                  {searching ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600" />
                    </div>
                  ) : suggestions.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-stone-400 italic text-center">No users found for "{query.trim()}"</p>
                  ) : (
                    <ul className="max-h-56 overflow-y-auto">
                      {suggestions.map(u => (
                        <li key={u.user_id}>
                          <button
                            type="button"
                            onClick={() => pickSuggestion(u)}
                            className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition flex items-center gap-3"
                          >
                            <div className="w-8 h-8 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                              {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-stone-800 truncate">{highlightMatch(u.full_name, query.trim())}</p>
                              <p className="text-[11px] text-stone-400 truncate">{highlightMatch(u.email, query.trim())}</p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {query.trim().length > 0 && query.trim().length < 2 && (
                <p className="text-[11px] text-stone-400 mt-1 italic">Type at least 2 characters to search…</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <select
              value={permission}
              onChange={e => setPermission(e.target.value)}
              className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 cursor-pointer bg-white"
            >
              <option value="read">👁️ Read only</option>
              <option value="editor">✏️ Editor</option>
            </select>
            <button
              type="submit"
              disabled={adding || !selected}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {adding ? '...' : 'Share'}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
        </form>

        {/* Current shares */}
        <div>
          <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">People with access</h4>
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
            </div>
          ) : shares.length === 0 ? (
            <p className="text-sm text-stone-400 italic text-center py-4">Not shared with anyone yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden">
              {shares.map(s => (
                <li key={s.user_id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-stone-800 truncate">{s.full_name}</p>
                    <p className="text-xs text-stone-400 truncate">{s.email}</p>
                  </div>
                  <select
                    value={s.permission}
                    onChange={e => handleChangePermission(s.user_id, e.target.value)}
                    className="text-xs border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-emerald-500 cursor-pointer bg-white"
                  >
                    <option value="read">👁️ Read</option>
                    <option value="editor">✏️ Editor</option>
                  </select>
                  <button
                    onClick={() => handleRemove(s.user_id)}
                    title="Remove access"
                    className="text-stone-300 hover:text-red-500 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold py-3 rounded-2xl transition"
        >
          Done
        </button>
      </div>
    </div>
  )
}

function highlightMatch(text, needle) {
  if (!text || !needle) return text
  const lowerText = text.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  const idx = lowerText.indexOf(lowerNeedle)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-emerald-100 text-emerald-800 font-bold rounded-sm px-0.5">{text.slice(idx, idx + needle.length)}</mark>
      {text.slice(idx + needle.length)}
    </>
  )
}
