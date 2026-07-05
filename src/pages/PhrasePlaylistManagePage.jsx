import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getPhrasePlaylist,
  updatePhrase,
  deletePhrase,
  updatePhraseGroup,
  deletePhraseGroup,
} from '../api/phrases'

const LANG_LABELS = { en: 'English', pt: 'Português' }
const LANG_FLAGS  = { en: '🇺🇸', pt: '🇧🇷' }

export default function PhrasePlaylistManagePage() {
  const { id } = useParams()
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [playlist, setPlaylist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingPhraseId, setEditingPhraseId] = useState(null)
  const [phraseDraft, setPhraseDraft] = useState({ text: '', translation_es: '', pronunciation_es: '' })
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [groupDraft, setGroupDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // {type: 'phrase'|'group', id, label}

  useEffect(() => { load() }, [id, token])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await getPhrasePlaylist(id, token)
      setPlaylist(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const canEdit = playlist?.role === 'owner' || playlist?.role === 'editor'

  function startEditPhrase(p) {
    setEditingPhraseId(p.id)
    setPhraseDraft({
      text: p.text,
      translation_es: p.translation_es,
      pronunciation_es: p.pronunciation_es || '',
    })
  }
  function cancelEditPhrase() {
    setEditingPhraseId(null)
    setPhraseDraft({ text: '', translation_es: '', pronunciation_es: '' })
  }
  async function savePhrase() {
    if (!phraseDraft.text.trim() || !phraseDraft.translation_es.trim()) {
      alert('text and translation_es are required')
      return
    }
    setSaving(true)
    try {
      await updatePhrase(editingPhraseId, phraseDraft, token)
      // Update local state
      setPlaylist(prev => ({
        ...prev,
        groups: prev.groups.map(g => ({
          ...g,
          phrases: g.phrases.map(ph =>
            ph.id === editingPhraseId ? { ...ph, ...phraseDraft } : ph
          ),
        })),
      }))
      cancelEditPhrase()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  function startEditGroup(g) {
    setEditingGroupId(g.id)
    setGroupDraft(g.name)
  }
  function cancelEditGroup() {
    setEditingGroupId(null)
    setGroupDraft('')
  }
  async function saveGroup() {
    if (!groupDraft.trim()) { alert('group name is required'); return }
    setSaving(true)
    try {
      await updatePhraseGroup(editingGroupId, groupDraft, token)
      setPlaylist(prev => ({
        ...prev,
        groups: prev.groups.map(g => g.id === editingGroupId ? { ...g, name: groupDraft } : g),
      }))
      cancelEditGroup()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function doDelete() {
    if (!confirmDelete) return
    setSaving(true)
    try {
      if (confirmDelete.type === 'phrase') {
        await deletePhrase(confirmDelete.id, token)
        setPlaylist(prev => ({
          ...prev,
          groups: prev.groups.map(g => ({
            ...g,
            phrases: g.phrases.filter(ph => ph.id !== confirmDelete.id),
          })),
        }))
      } else if (confirmDelete.type === 'group') {
        await deletePhraseGroup(confirmDelete.id, token)
        setPlaylist(prev => ({
          ...prev,
          groups: prev.groups.filter(g => g.id !== confirmDelete.id),
        }))
      }
      setConfirmDelete(null)
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
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
          <Link to={`/phrases/${id}`} className="text-stone-500 hover:text-stone-800 text-sm font-semibold transition">
            ← Back to review
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

      <main className="flex-1 max-w-5xl w-full mx-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-400">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-4"></div>
            <p>Loading playlist...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center">{error}</div>
        ) : !playlist ? null : (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="text-3xl">{LANG_FLAGS[playlist.language] || '🌐'}</span>
                <span className="bg-stone-100 text-stone-500 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                  {LANG_LABELS[playlist.language] || playlist.language}
                </span>
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                  ✏️ Manage
                </span>
              </div>
              <h2 className="text-2xl font-bold text-stone-800 tracking-tight">{playlist.name}</h2>
              {playlist.description && <p className="text-sm text-stone-500 mt-0.5">{playlist.description}</p>}
            </div>

            {!canEdit && (
              <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
                🔒 You have <span className="font-bold">read-only</span> access to this playlist. Ask the owner for editor permission to make changes.
              </div>
            )}

            {playlist.groups.length === 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
                <span className="text-5xl mb-4 block">📁</span>
                <p className="text-stone-500 mb-4">This playlist has no groups yet.</p>
                <Link to="/phrases/import" className="text-emerald-600 font-bold text-sm hover:text-emerald-700">
                  Import from JSON →
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {playlist.groups.map(g => (
                  <div key={g.id} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/50 flex items-center gap-3 flex-wrap">
                      {editingGroupId === g.id ? (
                        <>
                          <input
                            value={groupDraft}
                            onChange={e => setGroupDraft(e.target.value)}
                            className="flex-1 min-w-0 border border-stone-200 rounded-lg px-3 py-1.5 text-sm font-bold text-stone-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                            autoFocus
                          />
                          <button onClick={saveGroup} disabled={saving} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50">
                            Save
                          </button>
                          <button onClick={cancelEditGroup} className="text-xs font-bold text-stone-500 hover:text-stone-700 px-2">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <h3 className="text-lg font-bold text-stone-800 flex-1">{g.name}</h3>
                          <span className="text-xs text-stone-400 font-semibold">
                            {g.phrases.length} {g.phrases.length === 1 ? 'phrase' : 'phrases'}
                          </span>
                          {canEdit && (
                            <>
                              <button
                                onClick={() => startEditGroup(g)}
                                title="Rename group"
                                className="text-stone-400 hover:text-emerald-600 transition"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button
                                onClick={() => setConfirmDelete({ type: 'group', id: g.id, label: g.name })}
                                title="Delete group (and all its phrases)"
                                className="text-stone-400 hover:text-red-500 transition"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {g.phrases.length === 0 ? (
                      <p className="px-6 py-6 text-sm text-stone-400 italic text-center">No phrases in this group.</p>
                    ) : (
                      <ul className="divide-y divide-stone-100">
                        {g.phrases.map(p => (
                          <li key={p.id} className="px-6 py-4">
                            {editingPhraseId === p.id ? (
                              <div className="space-y-2">
                                <div>
                                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Text ({LANG_LABELS[playlist.language]})</label>
                                  <input
                                    value={phraseDraft.text}
                                    onChange={e => setPhraseDraft(d => ({ ...d, text: e.target.value }))}
                                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                                    autoFocus
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Traducción (español)</label>
                                  <input
                                    value={phraseDraft.translation_es}
                                    onChange={e => setPhraseDraft(d => ({ ...d, translation_es: e.target.value }))}
                                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Pronunciación (opcional)</label>
                                  <input
                                    value={phraseDraft.pronunciation_es}
                                    onChange={e => setPhraseDraft(d => ({ ...d, pronunciation_es: e.target.value }))}
                                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                                  />
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    onClick={savePhrase}
                                    disabled={saving}
                                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                                  >
                                    {saving ? 'Saving…' : 'Save'}
                                  </button>
                                  <button
                                    onClick={cancelEditPhrase}
                                    className="text-xs font-bold text-stone-500 hover:text-stone-700 px-2"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-3 group">
                                <div className="flex-1 min-w-0">
                                  <p className="text-base font-bold text-stone-800">{p.text}</p>
                                  <p className="text-sm text-emerald-700 mt-0.5">{p.translation_es}</p>
                                  {p.pronunciation_es && (
                                    <p className="text-xs text-stone-400 italic mt-0.5 font-mono">{p.pronunciation_es}</p>
                                  )}
                                </div>
                                {canEdit && (
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => startEditPhrase(p)}
                                      title="Edit phrase"
                                      className="text-stone-400 hover:text-emerald-600 transition p-1"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                    <button
                                      onClick={() => setConfirmDelete({ type: 'phrase', id: p.id, label: p.text })}
                                      title="Delete phrase"
                                      className="text-stone-400 hover:text-red-500 transition p-1"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-stone-900/30" onClick={() => !saving && setConfirmDelete(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center text-3xl mb-6 mx-auto">
              🗑️
            </div>
            <h3 className="text-2xl font-bold text-stone-800 text-center mb-2">
              Delete {confirmDelete.type}?
            </h3>
            <p className="text-stone-500 text-center mb-8 font-medium">
              {confirmDelete.type === 'group'
                ? <>The group <span className="text-stone-800 font-bold">"{confirmDelete.label}"</span> and all its phrases will be permanently deleted.</>
                : <>The phrase <span className="text-stone-800 font-bold">"{confirmDelete.label}"</span> will be permanently deleted.</>}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={doDelete}
                disabled={saving}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-2xl transition shadow-lg shadow-red-200 disabled:opacity-50"
              >
                {saving ? 'Deleting…' : `Yes, delete ${confirmDelete.type}`}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={saving}
                className="w-full bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold py-3 rounded-2xl transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
