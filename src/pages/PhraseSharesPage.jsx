import { useState, useEffect, useMemo } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  listPhrasePlaylists, listMyShares, addPlaylistShare, updatePlaylistShare,
  removePlaylistShare, adminListUsers, adminSetSharedRole,
} from '../api/phrases'

const LANG_FLAGS = { en: '🇺🇸', pt: '🇧🇷' }
const byName = (a, b) => a.localeCompare(b, undefined, { numeric: true })

// Admin page to give and take away access to my phrase playlists, seen either by
// playlist (who can see it) or by user (what they can see). Both views work on the same
// list of shares. Adding/removing a parent can also apply to its 📗 Vocab child, and a
// user can be limited to the /compartidos view.
export default function PhraseSharesPage() {
  const { user, token } = useAuth()
  const isAdmin = user?.roles?.includes('admin')

  const [playlists, setPlaylists] = useState([])
  const [users, setUsers] = useState([])
  const [shares, setShares] = useState([]) // [{playlist_id, user_id, permission}]
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('playlist') // 'playlist' | 'user'
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [withVocab, setWithVocab] = useState(true)
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState({}) // "playlistId:userId" or userId -> true

  useEffect(() => {
    if (!isAdmin) return
    Promise.all([
      listPhrasePlaylists(token, undefined, { includeVocab: true }),
      adminListUsers(token),
      listMyShares(token),
    ])
      .then(([pls, us, sh]) => {
        setPlaylists(pls.filter(p => p.role === 'owner'))
        setUsers(us.filter(u => u.id !== user?.id))
        setShares(sh)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [token, isAdmin, user?.id])

  const playlistsById = useMemo(() => Object.fromEntries(playlists.map(p => [p.id, p])), [playlists])
  const usersById = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users])
  const vocabOf = useMemo(() => {
    const m = {}
    playlists.forEach(p => { if (p.parent_playlist_id) m[p.parent_playlist_id] = p })
    return m
  }, [playlists])

  // Parents with their vocab child, sorted by name.
  const tree = useMemo(() => playlists
    .filter(p => !p.parent_playlist_id)
    .sort((a, b) => byName(a.name, b.name))
    .map(p => ({ playlist: p, vocab: vocabOf[p.id] || null })), [playlists, vocabOf])

  const sortedUsers = useMemo(() => [...users].sort((a, b) => byName(a.fullName, b.fullName)), [users])
  const countByPlaylist = {}
  const countByUser = {}
  shares.forEach(s => {
    countByPlaylist[s.playlist_id] = (countByPlaylist[s.playlist_id] || 0) + 1
    countByUser[s.user_id] = (countByUser[s.user_id] || 0) + 1
  })
  const findShare = (playlistId, userId) => shares.find(s => s.playlist_id === playlistId && s.user_id === userId)

  // ── Mutations (shared by both views) ──
  async function run(key, fn) {
    setBusy(b => ({ ...b, [key]: true }))
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(b => ({ ...b, [key]: false }))
    }
  }

  // The playlist plus, when the checkbox is on, its 📗 Vocab child.
  const targetsFor = playlistId => {
    const child = vocabOf[playlistId]
    return withVocab && child ? [playlistId, child.id] : [playlistId]
  }

  function grant(playlistId, userId) {
    const u = usersById[userId]
    run(`${playlistId}:${userId}`, async () => {
      const ids = targetsFor(playlistId).filter(id => !findShare(id, userId))
      for (const id of ids) await addPlaylistShare(id, u.email, 'read', token)
      setShares(prev => [...ids.map(id => ({ playlist_id: id, user_id: userId, permission: 'read' })), ...prev])
    })
  }

  function revoke(playlistId, userId) {
    run(`${playlistId}:${userId}`, async () => {
      const ids = targetsFor(playlistId).filter(id => findShare(id, userId))
      for (const id of ids) await removePlaylistShare(id, userId, token)
      setShares(prev => prev.filter(s => !(s.user_id === userId && ids.includes(s.playlist_id))))
    })
  }

  function changePermission(playlistId, userId, permission) {
    run(`${playlistId}:${userId}`, async () => {
      await updatePlaylistShare(playlistId, userId, permission, token)
      setShares(prev => prev.map(s => s.playlist_id === playlistId && s.user_id === userId ? { ...s, permission } : s))
    })
  }

  function setSharedRole(userId, enabled) {
    run(userId, async () => {
      const res = await adminSetSharedRole(userId, enabled, token)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, roles: res.roles } : u))
    })
  }

  function switchMode(next) {
    setMode(next)
    setFilter('')
  }

  if (!isAdmin) return <Navigate to="/phrases" replace />

  const q = filter.trim().toLowerCase()
  const selectedPlaylist = playlistsById[selectedPlaylistId] || null
  const selectedUser = usersById[selectedUserId] || null

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="bg-white border-b border-stone-200 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl">🎧</span>
          <span className="text-emerald-700 text-lg font-bold tracking-tight">Listen With Me</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/compartidos" className="text-stone-500 hover:text-sky-700 text-sm font-semibold transition">
            🤝 Vista compartida
          </Link>
          <Link to="/phrases" className="text-stone-500 hover:text-stone-800 text-sm font-semibold transition">
            ← Phrases
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-stone-800 tracking-tight">👥 Compartir playlists</h2>
            <p className="text-sm text-stone-400 mt-0.5">Agrega o quita acceso, viéndolo por playlist o por usuario.</p>
          </div>
          <div className="inline-flex bg-stone-200/70 rounded-xl p-1 self-start">
            {[['playlist', '📚 Por playlist'], ['user', '👤 Por usuario']].map(([m, label]) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${mode === m ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm flex justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError('')} className="font-bold">✕</button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[18rem_1fr] gap-6 items-start">
            {/* Left list */}
            <aside className="bg-white rounded-2xl border border-stone-200 p-2 md:sticky md:top-24 max-h-[70vh] overflow-y-auto">
              {mode === 'playlist'
                ? tree.map(({ playlist, vocab }) => (
                    <div key={playlist.id}>
                      <ListButton
                        icon={LANG_FLAGS[playlist.language] || '🌐'}
                        label={playlist.name}
                        count={countByPlaylist[playlist.id]}
                        active={playlist.id === selectedPlaylistId}
                        onClick={() => setSelectedPlaylistId(playlist.id)}
                      />
                      {vocab && (
                        <ListButton
                          indent label={vocab.name}
                          count={countByPlaylist[vocab.id]}
                          active={vocab.id === selectedPlaylistId}
                          onClick={() => setSelectedPlaylistId(vocab.id)}
                        />
                      )}
                    </div>
                  ))
                : sortedUsers.map(u => (
                    <ListButton
                      key={u.id}
                      icon={u.roles?.includes('shared') ? '🤝' : '👤'}
                      label={u.fullName}
                      sub={u.email}
                      count={countByUser[u.id]}
                      active={u.id === selectedUserId}
                      onClick={() => setSelectedUserId(u.id)}
                    />
                  ))}
            </aside>

            {/* Right panel */}
            <section className="bg-white rounded-2xl border border-stone-200 p-5 min-h-[20rem]">
              {mode === 'playlist' ? (
                !selectedPlaylist ? (
                  <Empty text="Elige un playlist para ver quién tiene acceso." />
                ) : (() => {
                  const withAccess = shares.filter(s => s.playlist_id === selectedPlaylist.id && usersById[s.user_id])
                  const others = sortedUsers
                    .filter(u => !findShare(selectedPlaylist.id, u.id))
                    .filter(u => !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
                  return (
                    <>
                      <h3 className="text-xl font-bold text-stone-800">{selectedPlaylist.name}</h3>
                      <p className="text-xs text-stone-400 mb-4">{selectedPlaylist.phrase_count} frases · {selectedPlaylist.group_count} grupos</p>
                      <VocabToggle child={vocabOf[selectedPlaylist.id]} checked={withVocab} onChange={setWithVocab} />

                      <SectionTitle>Con acceso ({withAccess.length})</SectionTitle>
                      {withAccess.length === 0 ? (
                        <p className="text-sm text-stone-400 mb-6">Nadie más tiene acceso todavía.</p>
                      ) : (
                        <ul className="mb-6 divide-y divide-stone-100 border border-stone-100 rounded-xl">
                          {withAccess.map(s => {
                            const u = usersById[s.user_id]
                            const key = `${s.playlist_id}:${u.id}`
                            return (
                              <Row key={u.id} dim={busy[key] || busy[u.id]}>
                                <Label title={u.fullName} sub={u.email} />
                                <PermissionSelect value={s.permission} disabled={busy[key]} onChange={p => changePermission(s.playlist_id, u.id, p)} />
                                <SharedRoleToggle u={u} disabled={busy[u.id]} onChange={on => setSharedRole(u.id, on)} />
                                <RemoveButton disabled={busy[key]} onClick={() => revoke(s.playlist_id, u.id)} />
                              </Row>
                            )
                          })}
                        </ul>
                      )}

                      <SectionTitle>Agregar usuarios</SectionTitle>
                      <SearchBox value={filter} onChange={setFilter} placeholder="Buscar por nombre o correo…" />
                      {others.length === 0 ? (
                        <p className="text-sm text-stone-400">No hay más usuarios{q ? ' con ese nombre' : ''}.</p>
                      ) : (
                        <ul className="divide-y divide-stone-100 border border-stone-100 rounded-xl max-h-80 overflow-y-auto">
                          {others.map(u => (
                            <Row key={u.id} dim={busy[`${selectedPlaylist.id}:${u.id}`]}>
                              <Label title={u.fullName} sub={u.email} />
                              {u.roles?.includes('shared') && <SharedBadge />}
                              <AddButton disabled={busy[`${selectedPlaylist.id}:${u.id}`]} onClick={() => grant(selectedPlaylist.id, u.id)} />
                            </Row>
                          ))}
                        </ul>
                      )}
                      <Footnote />
                    </>
                  )
                })()
              ) : (
                !selectedUser ? (
                  <Empty text="Elige un usuario para ver sus playlists." />
                ) : (() => {
                  const mine = shares
                    .filter(s => s.user_id === selectedUser.id && playlistsById[s.playlist_id])
                    .sort((a, b) => byName(playlistsById[a.playlist_id].name, playlistsById[b.playlist_id].name))
                  const missing = playlists
                    .filter(p => !findShare(p.id, selectedUser.id))
                    .filter(p => !q || p.name.toLowerCase().includes(q))
                    .sort((a, b) => byName(a.name, b.name))
                  const isAdminUser = selectedUser.roles?.includes('admin')
                  return (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-stone-800">{selectedUser.fullName}</h3>
                          <p className="text-xs text-stone-400">{selectedUser.email}{isAdminUser ? ' · admin' : ''}</p>
                        </div>
                        {!isAdminUser && (
                          <label className={`flex items-center gap-2 text-sm font-semibold rounded-xl px-3 py-2 border cursor-pointer ${selectedUser.roles?.includes('shared') ? 'bg-sky-50 border-sky-200 text-sky-800' : 'bg-stone-50 border-stone-200 text-stone-600'}`}>
                            <input
                              type="checkbox"
                              checked={!!selectedUser.roles?.includes('shared')}
                              disabled={busy[selectedUser.id]}
                              onChange={e => setSharedRole(selectedUser.id, e.target.checked)}
                              className="accent-sky-600"
                            />
                            🤝 Solo vista compartida
                          </label>
                        )}
                      </div>
                      <label className="mb-5 flex items-center gap-2 text-sm text-stone-600 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 cursor-pointer">
                        <input type="checkbox" checked={withVocab} onChange={e => setWithVocab(e.target.checked)} className="accent-emerald-600" />
                        Al agregar o quitar un playlist, aplicarlo también a su <b>📗 Vocab</b>
                      </label>

                      <SectionTitle>Playlists que puede ver ({mine.length})</SectionTitle>
                      {mine.length === 0 ? (
                        <p className="text-sm text-stone-400 mb-6">No tiene ningún playlist tuyo compartido.</p>
                      ) : (
                        <ul className="mb-6 divide-y divide-stone-100 border border-stone-100 rounded-xl">
                          {mine.map(s => {
                            const p = playlistsById[s.playlist_id]
                            const key = `${p.id}:${selectedUser.id}`
                            return (
                              <Row key={p.id} dim={busy[key]}>
                                <Label icon={p.parent_playlist_id ? null : (LANG_FLAGS[p.language] || '🌐')} title={p.name} sub={`${p.phrase_count} frases`} />
                                <PermissionSelect value={s.permission} disabled={busy[key]} onChange={perm => changePermission(p.id, selectedUser.id, perm)} />
                                <RemoveButton disabled={busy[key]} onClick={() => revoke(p.id, selectedUser.id)} />
                              </Row>
                            )
                          })}
                        </ul>
                      )}

                      <SectionTitle>Agregar playlists</SectionTitle>
                      <SearchBox value={filter} onChange={setFilter} placeholder="Buscar playlist…" />
                      {missing.length === 0 ? (
                        <p className="text-sm text-stone-400">Ya tiene todos{q ? ' los que coinciden' : ''}.</p>
                      ) : (
                        <ul className="divide-y divide-stone-100 border border-stone-100 rounded-xl max-h-80 overflow-y-auto">
                          {missing.map(p => (
                            <Row key={p.id} dim={busy[`${p.id}:${selectedUser.id}`]}>
                              <Label icon={p.parent_playlist_id ? null : (LANG_FLAGS[p.language] || '🌐')} title={p.name} sub={`${p.phrase_count} frases`} />
                              <AddButton disabled={busy[`${p.id}:${selectedUser.id}`]} onClick={() => grant(p.id, selectedUser.id)} />
                            </Row>
                          ))}
                        </ul>
                      )}
                      <Footnote />
                    </>
                  )
                })()
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

function ListButton({ icon, label, sub, count, active, indent, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${indent ? 'pl-8' : ''} ${active ? 'bg-emerald-600 text-white' : 'hover:bg-stone-100 text-stone-700'}`}
    >
      <span>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block truncate font-semibold">{label}</span>
        {sub && <span className={`block truncate text-xs ${active ? 'text-emerald-100' : 'text-stone-400'}`}>{sub}</span>}
      </span>
      {count > 0 && (
        <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${active ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-700'}`}>{count}</span>
      )}
    </button>
  )
}

function VocabToggle({ child, checked, onChange }) {
  if (!child) return null
  return (
    <label className="mb-5 flex items-center gap-2 text-sm text-stone-600 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-emerald-600" />
      Agregar y quitar también en <b>📗 {child.name}</b>
    </label>
  )
}

const Empty = ({ text }) => (
  <div className="h-full flex flex-col items-center justify-center text-center text-stone-400 py-16">
    <span className="text-5xl mb-3">👈</span>
    <p>{text}</p>
  </div>
)

const SectionTitle = ({ children }) => (
  <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">{children}</h4>
)

const Row = ({ dim, children }) => (
  <li className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${dim ? 'opacity-50' : ''}`}>{children}</li>
)

const Label = ({ icon, title, sub }) => (
  <div className="flex-1 min-w-[10rem] flex items-center gap-2">
    {icon && <span>{icon}</span>}
    <div className="min-w-0">
      <p className="text-sm font-semibold text-stone-800 leading-tight truncate">{title}</p>
      <p className="text-xs text-stone-400 truncate">{sub}</p>
    </div>
  </div>
)

const PermissionSelect = ({ value, disabled, onChange }) => (
  <select
    value={value}
    disabled={disabled}
    onChange={e => onChange(e.target.value)}
    className="text-xs font-bold bg-stone-50 border border-stone-200 rounded-lg px-2 py-1"
  >
    <option value="read">Solo ver</option>
    <option value="editor">Editor</option>
  </select>
)

function SharedRoleToggle({ u, disabled, onChange }) {
  if (u.roles?.includes('admin')) return null
  return (
    <label className="flex items-center gap-1.5 text-xs text-stone-500 cursor-pointer" title="Al iniciar sesión solo verá la vista /compartidos">
      <input type="checkbox" checked={!!u.roles?.includes('shared')} disabled={disabled} onChange={e => onChange(e.target.checked)} className="accent-sky-600" />
      Solo vista compartida
    </label>
  )
}

const SharedBadge = () => (
  <span className="text-[10px] font-bold uppercase bg-sky-100 text-sky-700 rounded px-1.5 py-0.5">Solo compartida</span>
)

const RemoveButton = ({ disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="text-xs font-bold text-red-500 hover:text-white hover:bg-red-500 border border-red-200 rounded-lg px-2.5 py-1 transition"
  >
    Quitar
  </button>
)

const AddButton = ({ disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-2.5 py-1 transition"
  >
    + Agregar
  </button>
)

const SearchBox = ({ value, onChange, placeholder }) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full mb-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
  />
)

const Footnote = () => (
  <p className="text-xs text-stone-400 mt-4">
    "Solo vista compartida" hace que ese usuario solo vea <b>/compartidos</b>. Se aplica la próxima vez que inicie sesión.
  </p>
)
