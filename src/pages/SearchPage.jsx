import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getSearchSources, searchContent, generatePhraseAudio } from '../api/phrases'
import { SORT_OPTIONS, shuffleArray } from '../utils/phraseSort'

const DEBOUNCE_MS = 300
// Results render in pages so a broad query doesn't mount hundreds of rows at once.
const PAGE_SIZE = 50

const KIND_LABELS = { phrases: '💬', vocab: '📗', story_words: '📖' }

// Lowercase + strip accents, mirroring the backend's folding, for highlighting.
const foldChar = c => c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
// A leading space anchors the first word to a word start, a trailing space the last
// word to a word end (same rule as the backend).
function searchTokens(q) {
  const words = [...(q || '')].map(foldChar).join('').split(/\s+/).filter(Boolean)
  const tokens = words.map(word => ({ word, start: false, end: false }))
  if (tokens.length) {
    tokens[0].start = /^\s/.test(q)
    tokens[tokens.length - 1].end = /\s$/.test(q)
  }
  return tokens
}

const isWordChar = c => c !== undefined && /[\p{L}\p{N}]/u.test(c)

// Wraps every occurrence of the search words in <mark>, matching accent-insensitively
// against the original text (map[] points each folded char back to its original char).
function highlightMatches(text, tokens) {
  if (!text || tokens.length === 0) return text
  const chars = [...text]
  let normStr = ''
  const map = []
  chars.forEach((c, i) => { for (const ch of foldChar(c)) { normStr += ch; map.push(i) } })
  const marked = new Array(chars.length).fill(false)
  for (const { word, start, end } of tokens) {
    let from = 0, at
    while ((at = normStr.indexOf(word, from)) !== -1) {
      const okStart = !start || !isWordChar(normStr[at - 1])
      const okEnd = !end || !isWordChar(normStr[at + word.length])
      if (okStart && okEnd) {
        for (let k = at; k < at + word.length; k++) marked[map[k]] = true
        from = at + word.length
      } else {
        from = at + 1
      }
    }
  }
  const parts = []
  chars.forEach((c, i) => {
    const last = parts[parts.length - 1]
    if (last && last.m === marked[i]) last.t += c
    else parts.push({ t: c, m: marked[i] })
  })
  return parts.map((p, i) => p.m
    ? <mark key={i} className="bg-amber-200 text-stone-900 rounded px-0.5">{p.t}</mark>
    : <span key={i}>{p.t}</span>)
}

// Phrases and story paragraphs as one list shape.
function toItems(res) {
  const phrases = (res.phrases || []).map(p => ({
    key: `p${p.id}`,
    kind: 'phrase',
    id: p.id,
    text: p.text,
    translation: p.translation_es,
    pronunciation: p.pronunciation_es,
    createdAt: p.created_at,
    reviewCount: p.review_count,
    nextReviewAt: p.next_review_at,
    source: `${p.playlist_name} · ${p.group_name}`,
    link: `/phrases/${p.playlist_id}`,
    audioURL: p.polly_audio_url_female,
    segmentURL: p.source_audio_url,
    segmentStartMs: p.source_start_ms,
    segmentEndMs: p.source_end_ms,
  }))
  const paragraphs = (res.paragraphs || []).map(p => ({
    key: `s${p.id}`,
    kind: 'story',
    id: p.id,
    text: p.text,
    translation: p.translation_es,
    pronunciation: p.pronunciation_es,
    createdAt: p.created_at,
    reviewCount: 0,
    nextReviewAt: null,
    source: `${p.story_title} · ${p.playlist_names}`,
    link: `/stories/${p.story_id}`,
    audioURL: p.audio_url,
  }))
  return [...phrases, ...paragraphs]
}

// Same orderings as the review deck. Story paragraphs have no reviews/SRS, so they
// count as never reviewed / new. SRS keeps not-yet-due items at the end.
function sortItems(list, sortBy) {
  const flat = [...list]
  const now = Date.now()
  const t = s => new Date(s).getTime()
  switch (sortBy) {
    case 'newest':
      return flat.sort((a, b) => t(b.createdAt) - t(a.createdAt))
    case 'oldest':
      return flat.sort((a, b) => t(a.createdAt) - t(b.createdAt))
    case 'least_reviewed':
      return flat.sort((a, b) => a.reviewCount - b.reviewCount || t(a.createdAt) - t(b.createdAt))
    case 'random':
      return shuffleArray(flat)
    case 'srs': {
      const due = flat.filter(i => i.nextReviewAt && t(i.nextReviewAt) <= now).sort((a, b) => t(a.nextReviewAt) - t(b.nextReviewAt))
      const fresh = flat.filter(i => !i.nextReviewAt).sort((a, b) => t(b.createdAt) - t(a.createdAt))
      const later = flat.filter(i => i.nextReviewAt && t(i.nextReviewAt) > now).sort((a, b) => t(a.nextReviewAt) - t(b.nextReviewAt))
      return [...due, ...fresh, ...later]
    }
    case 'playlist':
    default:
      // Server order: playlist, group/story, position.
      return flat
  }
}

function srsBadge(item) {
  if (item.kind === 'story') return null
  if (!item.nextReviewAt) return { label: 'Nueva', cls: 'bg-sky-100 text-sky-700' }
  const days = (new Date(item.nextReviewAt).getTime() - Date.now()) / 86400000
  if (days <= 0) return { label: 'Toca repasar', cls: 'bg-red-100 text-red-700' }
  return { label: `En ${Math.ceil(days)} d`, cls: 'bg-stone-100 text-stone-500' }
}

// Checkbox list for one kind of source. `selected` is a Set of ids.
function SourceSection({ title, items, selected, onChange, renderMeta }) {
  const allOn = items.length > 0 && items.every(i => selected.has(i.id))
  const toggle = id => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-stone-400 font-semibold uppercase tracking-wider">{title}</span>
        <div className="flex gap-2 text-[11px] font-bold">
          <button onClick={() => onChange(new Set(items.map(i => i.id)))} disabled={allOn} className="text-emerald-600 hover:text-emerald-800 disabled:text-stone-300 transition">Todos</button>
          <button onClick={() => onChange(new Set())} disabled={selected.size === 0} className="text-stone-500 hover:text-stone-800 disabled:text-stone-300 transition">Ninguno</button>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-stone-400">No tienes playlists aquí.</p>
      ) : (
        <ul className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
          {items.map(i => (
            <li key={i.id}>
              <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-stone-50 cursor-pointer text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={selected.has(i.id)}
                  onChange={() => toggle(i.id)}
                  className="accent-emerald-600 w-4 h-4 flex-shrink-0"
                />
                <span className="truncate flex-1">{i.is_favorite && '⭐ '}{i.name}</span>
                <span className="text-[11px] text-stone-400 flex-shrink-0">{renderMeta(i)}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function SearchPage() {
  const { user, token, logout, sharedOnly } = useAuth()
  const navigate = useNavigate()

  const [sources, setSources] = useState(null) // {phrase_playlists, story_playlists}
  const [sourcesError, setSourcesError] = useState('')
  // null = every playlist of that kind (the default); otherwise a Set of chosen ids.
  const [phraseSel, setPhraseSel] = useState(null)
  const [storySel, setStorySel] = useState(null)
  const [showSources, setShowSources] = useState(false)

  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('playlist')
  const [result, setResult] = useState(null) // {key, items, truncated}
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [paging, setPaging] = useState({ key: '', count: PAGE_SIZE })

  // Audio URLs generated during this visit, keyed by phrase id.
  const [generatedAudio, setGeneratedAudio] = useState({})
  const [playingKey, setPlayingKey] = useState(null)
  const [loadingKey, setLoadingKey] = useState(null)
  const audioRef = useRef(null)
  const rafRef = useRef(null)
  const requestSeq = useRef(0)

  useEffect(() => {
    getSearchSources(token)
      .then(setSources)
      .catch(err => setSourcesError(err.message))
  }, [token])

  const phraseIds = useMemo(() => (sources?.phrase_playlists || []).map(p => p.id), [sources])
  const storyIds = useMemo(() => (sources?.story_playlists || []).map(p => p.id), [sources])
  const phraseSelected = phraseSel ?? new Set(phraseIds)
  const storySelected = storySel ?? new Set(storyIds)

  // A Set that covers everything collapses back to "all", so new playlists are included too.
  const setPhraseSelection = s => setPhraseSel(s.size === phraseIds.length ? null : s)
  const setStorySelection = s => setStorySel(s.size === storyIds.length ? null : s)

  // Favorite playlists of both kinds, for the one-click filter chips.
  const favorites = useMemo(() => [
    ...(sources?.phrase_playlists || []).filter(p => p.is_favorite).map(p => ({ kind: 'phrase', id: p.id, name: p.name })),
    ...(sources?.story_playlists || []).filter(p => p.is_favorite).map(p => ({ kind: 'story', id: p.id, name: p.name })),
  ], [sources])
  const isAll = phraseSel === null && storySel === null
  const isFavOn = f => !isAll && (f.kind === 'phrase' ? phraseSelected : storySelected).has(f.id)
  const onlyFavorites = !isAll && favorites.length > 0 &&
    phraseSelected.size + storySelected.size === favorites.length && favorites.every(isFavOn)

  const resetSources = () => { setPhraseSel(null); setStorySel(null) }
  // From "all", a chip narrows the search to just that playlist; after that, chips
  // add/remove playlists. Removing the last one goes back to searching everything.
  function toggleFavorite(f) {
    const phr = isAll ? new Set() : new Set(phraseSelected)
    const sto = isAll ? new Set() : new Set(storySelected)
    const set = f.kind === 'phrase' ? phr : sto
    if (!isAll && set.has(f.id)) set.delete(f.id)
    else set.add(f.id)
    if (phr.size === 0 && sto.size === 0) { resetSources(); return }
    setPhraseSel(phr)
    setStorySel(sto)
  }
  function selectAllFavorites() {
    setPhraseSel(new Set(favorites.filter(f => f.kind === 'phrase').map(f => f.id)))
    setStorySel(new Set(favorites.filter(f => f.kind === 'story').map(f => f.id)))
  }

  const totalSources = phraseIds.length + storyIds.length
  const chosenSources = phraseSelected.size + storySelected.size
  const nothingSelected = sources && chosenSources === 0

  const tokens = useMemo(() => searchTokens(query), [query])
  const phraseParam = phraseSel ? [...phraseSel].sort((a, b) => a - b) : null
  const storyParam = storySel ? [...storySel].sort((a, b) => a - b) : null
  // Edge spaces matter (word anchors), so collapse them to one instead of trimming.
  const searchKey = tokens.length === 0 || nothingSelected
    ? ''
    : JSON.stringify([query.replace(/^\s+/, ' ').replace(/\s+$/, ' '), phraseParam, storyParam])

  // Debounced fetch; responses from stale keys are ignored.
  useEffect(() => {
    if (!searchKey) return
    const seq = ++requestSeq.current
    const [q, phr, sto] = JSON.parse(searchKey)
    const timer = setTimeout(() => {
      setSearching(true)
      setError('')
      searchContent(q, phr, sto, token)
        .then(res => {
          if (seq !== requestSeq.current) return
          setResult({ key: searchKey, items: toItems(res), truncated: res.phrases_truncated || res.paragraphs_truncated })
        })
        .catch(err => { if (seq === requestSeq.current) setError(err.message) })
        .finally(() => { if (seq === requestSeq.current) setSearching(false) })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchKey, token])

  const current = result && searchKey && result.key === searchKey ? result : null
  // Keep showing the previous results while the next query is in flight (no flicker).
  const shown = searchKey ? (current || result) : null
  const items = useMemo(() => (shown ? sortItems(shown.items, sortBy) : []), [shown, sortBy])

  const pageKey = `${searchKey}|${sortBy}`
  const visible = paging.key === pageKey ? paging.count : PAGE_SIZE
  const showMore = () => setPaging({ key: pageKey, count: visible + PAGE_SIZE })

  const stopAudio = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (audioRef.current) { try { audioRef.current.pause() } catch { /* noop */ } }
    audioRef.current = null
    setPlayingKey(null)
  }, [])
  useEffect(() => stopAudio, [stopAudio])

  // Story-linked phrases play their segment of the story mp3; paragraphs their own
  // narration; other phrases their ElevenLabs audio (generated on first play).
  const play = useCallback(async (item) => {
    if (playingKey === item.key) { stopAudio(); return } // toggle off
    stopAudio()

    if (item.segmentURL) {
      const audio = new Audio(item.segmentURL)
      audioRef.current = audio
      const startSec = (item.segmentStartMs || 0) / 1000
      const endSec = (item.segmentEndMs || 0) / 1000
      const tick = () => {
        if (audio.paused) { rafRef.current = null; return }
        if (endSec > 0 && audio.currentTime >= endSec) { stopAudio(); return }
        rafRef.current = requestAnimationFrame(tick)
      }
      const start = () => {
        try { audio.currentTime = startSec } catch { /* ignore */ }
        audio.play().then(() => {
          setPlayingKey(item.key)
          rafRef.current = requestAnimationFrame(tick)
        }).catch(err => {
          if (err && err.name !== 'AbortError') console.error('Story segment playback:', err)
          stopAudio()
        })
      }
      audio.onended = stopAudio
      audio.onerror = stopAudio
      if (audio.readyState >= 1) start()
      else audio.addEventListener('loadedmetadata', start, { once: true })
      return
    }

    let url = item.audioURL || (item.kind === 'phrase' ? generatedAudio[item.id] : '')
    if (!url) {
      if (item.kind !== 'phrase') return
      setLoadingKey(item.key)
      try {
        url = (await generatePhraseAudio(item.id, token)).audio_url
        setGeneratedAudio(prev => ({ ...prev, [item.id]: url }))
      } catch (err) {
        alert(`Audio failed: ${err.message}`)
        return
      } finally {
        setLoadingKey(null)
      }
    }
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onplay = () => setPlayingKey(item.key)
    audio.onended = () => { if (audioRef.current === audio) stopAudio() }
    audio.onerror = () => { if (audioRef.current === audio) stopAudio() }
    audio.play().catch(err => {
      if (err && err.name !== 'AbortError') console.error('Audio playback:', err)
      if (audioRef.current === audio) stopAudio()
    })
  }, [playingKey, stopAudio, generatedAudio, token])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const phraseCount = items.filter(i => i.kind === 'phrase').length
  const storyCount = items.length - phraseCount

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="bg-white border-b border-stone-200 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
        <Link to={sharedOnly ? '/compartidos' : '/'} className="flex items-center gap-2">
          <span className="text-2xl">🎧</span>
          <span className="text-emerald-700 text-lg font-bold tracking-tight">Listen With Me</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link to={sharedOnly ? '/compartidos' : '/phrases'} className="text-stone-500 hover:text-stone-800 text-sm font-semibold transition">
            {sharedOnly ? '← Mis playlists' : '← Phrases'}
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

      <main className="flex-1 max-w-3xl w-full mx-auto p-6 flex flex-col">
        <div className="mb-5">
          <h2 className="text-2xl font-bold text-stone-800 tracking-tight">🔎 Buscar</h2>
          <p className="text-sm text-stone-400 mt-0.5">En tus playlists de frases e historias, en inglés o en español.</p>
        </div>

        {/* Search box */}
        <div className="relative mb-3">
          <svg className="w-5 h-5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
          </svg>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setQuery('') }}
            placeholder="Una o varias palabras, en inglés o en español…"
            className="w-full border border-stone-200 rounded-2xl pl-11 pr-10 py-3 text-base text-stone-700 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all shadow-sm"
          />
          {searching ? (
            <svg className="w-5 h-5 animate-spin text-emerald-500 absolute right-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
              <path className="opacity-90" d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          ) : query && (
            <button
              onClick={() => setQuery('')}
              title="Limpiar (Esc)"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 flex items-center justify-center transition"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sources + sort */}
        <div className="mb-3 flex flex-col sm:flex-row gap-3 sm:items-center">
          <button
            onClick={() => setShowSources(v => !v)}
            disabled={!sources}
            className={`flex-1 flex items-center justify-between gap-2 border rounded-xl px-3 py-2 text-sm bg-white transition ${showSources ? 'border-emerald-500 ring-2 ring-emerald-500/10' : 'border-stone-200 hover:border-emerald-400'} ${nothingSelected ? 'text-red-600' : 'text-stone-700'}`}
          >
            <span className="truncate">
              📚 Buscar en:{' '}
              <span className="font-semibold">
                {!sources
                  ? 'cargando…'
                  : chosenSources === totalSources
                    ? `todos los playlists (${totalSources})`
                    : nothingSelected
                      ? 'ningún playlist'
                      : `${chosenSources} de ${totalSources} playlists`}
              </span>
            </span>
            <svg className={`w-4 h-4 text-stone-400 transition-transform ${showSources ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
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

        {sourcesError && <p className="text-xs text-red-500 mb-3">{sourcesError}</p>}

        {/* Quick filters: favorite playlists */}
        {favorites.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-stone-400 font-semibold uppercase tracking-wider mr-1">Rápido:</span>
            <button
              onClick={resetSources}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${isAll ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-stone-500 border-stone-200 hover:border-emerald-400 hover:text-emerald-700'}`}
            >
              Todo
            </button>
            {favorites.length > 1 && (
              <button
                onClick={onlyFavorites ? resetSources : selectAllFavorites}
                title="Buscar solo en tus playlists favoritos"
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${onlyFavorites ? 'bg-amber-400 text-white border-amber-400' : 'bg-white text-amber-700 border-amber-200 hover:border-amber-400'}`}
              >
                ⭐ Todos mis favoritos
              </button>
            )}
            {favorites.map(f => {
              const on = isFavOn(f)
              return (
                <button
                  key={`${f.kind}${f.id}`}
                  onClick={() => toggleFavorite(f)}
                  title={f.kind === 'phrase' ? 'Playlist de frases' : 'Playlist de historias'}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition flex items-center gap-1 ${on ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-white text-stone-600 border-stone-200 hover:border-amber-300'}`}
                >
                  <span>{f.kind === 'phrase' ? '💬' : '📚'}</span>
                  {f.name}
                </button>
              )
            })}
          </div>
        )}

        {showSources && sources && (
          <div className={`mb-4 bg-white border border-stone-200 rounded-2xl p-4 grid grid-cols-1 gap-5 ${sharedOnly ? '' : 'sm:grid-cols-2'}`}>
            <SourceSection
              title="💬 Playlists de frases"
              items={sources.phrase_playlists}
              selected={phraseSelected}
              onChange={setPhraseSelection}
              renderMeta={p => `${KIND_LABELS[p.kind] || ''} ${p.phrase_count}`}
            />
            {!sharedOnly && <SourceSection
              title="📚 Playlists de historias"
              items={sources.story_playlists}
              selected={storySelected}
              onChange={setStorySelection}
              renderMeta={p => `${p.story_count} historia${p.story_count === 1 ? '' : 's'}`}
            />}
          </div>
        )}

        {/* Results */}
        {nothingSelected ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center text-stone-500">
            Elige al menos un playlist para buscar.
          </div>
        ) : !searchKey ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
            <span className="text-5xl mb-3 block">🔎</span>
            <p className="text-stone-500">Escribe una o varias palabras para buscar.</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-center">{error}</div>
        ) : !shown ? null : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
            <span className="text-5xl mb-3 block">🔍</span>
            <p className="text-stone-500">No hay resultados para "{query.trim()}".</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-stone-400 mb-3">
              {phraseCount} frase{phraseCount === 1 ? '' : 's'}
              {!sharedOnly && <> · {storyCount} párrafo{storyCount === 1 ? '' : 's'} de historias</>}
              {shown.truncated && ' — se muestran los primeros 300 de cada tipo; afina la búsqueda para ver más.'}
            </p>
            <ul className={`space-y-2 transition-opacity ${searching ? 'opacity-60' : ''}`}>
              {items.slice(0, visible).map(item => {
                const isPlaying = playingKey === item.key
                const isLoading = loadingKey === item.key
                const canPlay = item.kind === 'phrase' || !!item.audioURL
                const badge = sortBy === 'srs' ? srsBadge(item) : null
                return (
                  <li key={item.key} className="bg-white rounded-2xl border border-stone-200 p-4 flex gap-4 items-start hover:border-emerald-200 transition">
                    <button
                      onClick={() => play(item)}
                      disabled={isLoading || !canPlay}
                      title={!canPlay ? 'Sin audio' : isPlaying ? 'Detener' : 'Escuchar'}
                      className={`w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center border-2 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${isPlaying ? 'bg-emerald-600 border-emerald-600 text-white animate-pulse' : 'bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400'}`}
                    >
                      {isLoading ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                          <path className="opacity-90" d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                        </svg>
                      ) : isPlaying ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                      ) : (
                        <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-stone-800 leading-snug">{highlightMatches(item.text, tokens)}</p>
                      {item.pronunciation && (
                        <p className="text-sm text-stone-400 italic font-mono mt-0.5">{item.pronunciation}</p>
                      )}
                      {item.translation && (
                        <p className="text-sm text-emerald-700 mt-1">{highlightMatches(item.translation, tokens)}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${item.kind === 'phrase' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>
                          {item.kind === 'phrase' ? 'Frase' : 'Historia'}
                        </span>
                        <Link to={item.link} className="text-[11px] text-stone-400 hover:text-emerald-700 font-semibold truncate transition">
                          {item.source}
                        </Link>
                        {badge && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
                        )}
                        {sortBy === 'least_reviewed' && item.kind === 'phrase' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">
                            {item.reviewCount} repaso{item.reviewCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            {visible < items.length && (
              <button
                onClick={showMore}
                className="mt-4 self-center text-sm font-bold text-emerald-600 border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 rounded-xl px-5 py-2.5 transition"
              >
                Mostrar más ({items.length - visible} restantes)
              </button>
            )}
          </>
        )}
      </main>
    </div>
  )
}
