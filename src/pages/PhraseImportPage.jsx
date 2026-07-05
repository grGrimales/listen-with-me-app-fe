import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { importPhrasePlaylist } from '../api/phrases'

const EXAMPLE_JSON = `{
  "playlist": {
    "name": "Mi lista de frases",
    "language": "en",
    "description": "Frases para practicar"
  },
  "groups": [
    {
      "name": "Grupo 1",
      "phrases": [
        { "text": "Hello",       "translation_es": "Hola",         "pronunciation_es": "jelou" },
        { "text": "Good morning","translation_es": "Buenos días",  "pronunciation_es": "gud mornin" }
      ]
    },
    {
      "name": "Grupo 2",
      "phrases": [
        { "text": "Thank you", "translation_es": "Gracias", "pronunciation_es": "zenk yu" }
      ]
    }
  ]
}`

function validatePayload(parsed) {
  const errors = []
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    errors.push('Root must be a JSON object')
    return errors
  }
  const p = parsed.playlist
  if (!p || typeof p !== 'object') {
    errors.push('"playlist" object is required')
  } else {
    if (!p.name || typeof p.name !== 'string' || !p.name.trim()) errors.push('"playlist.name" must be a non-empty string')
    if (!p.language || (p.language !== 'en' && p.language !== 'pt')) errors.push('"playlist.language" must be "en" or "pt"')
    if (p.description !== undefined && typeof p.description !== 'string') errors.push('"playlist.description" must be a string')
  }

  const g = parsed.groups
  if (!Array.isArray(g) || g.length === 0) {
    errors.push('"groups" must be a non-empty array')
  } else {
    g.forEach((grp, gi) => {
      if (!grp || typeof grp !== 'object') { errors.push(`groups[${gi}] must be an object`); return }
      if (!grp.name || typeof grp.name !== 'string' || !grp.name.trim()) errors.push(`groups[${gi}].name must be a non-empty string`)
      if (!Array.isArray(grp.phrases) || grp.phrases.length === 0) {
        errors.push(`groups[${gi}].phrases must be a non-empty array`)
      } else {
        grp.phrases.forEach((ph, pi) => {
          if (!ph || typeof ph !== 'object') { errors.push(`groups[${gi}].phrases[${pi}] must be an object`); return }
          if (!ph.text || typeof ph.text !== 'string' || !ph.text.trim()) errors.push(`groups[${gi}].phrases[${pi}].text must be a non-empty string`)
          if (!ph.translation_es || typeof ph.translation_es !== 'string' || !ph.translation_es.trim()) errors.push(`groups[${gi}].phrases[${pi}].translation_es must be a non-empty string`)
          if (ph.pronunciation_es !== undefined && typeof ph.pronunciation_es !== 'string') errors.push(`groups[${gi}].phrases[${pi}].pronunciation_es must be a string`)
        })
      }
    })
  }
  return errors
}

export default function PhraseImportPage() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [serverError, setServerError] = useState('')
  const [copied, setCopied] = useState(false)

  const { parsed, syntaxError, validationErrors } = useMemo(() => {
    if (!text.trim()) return { parsed: null, syntaxError: null, validationErrors: [] }
    try {
      const p = JSON.parse(text)
      return { parsed: p, syntaxError: null, validationErrors: validatePayload(p) }
    } catch (e) {
      return { parsed: null, syntaxError: e.message, validationErrors: [] }
    }
  }, [text])

  const isValid = text.trim() && !syntaxError && validationErrors.length === 0
  const totalPhrasesInPayload = useMemo(() => {
    if (!parsed?.groups) return 0
    return parsed.groups.reduce((n, g) => n + (Array.isArray(g.phrases) ? g.phrases.length : 0), 0)
  }, [parsed])

  async function handleSubmit() {
    if (!isValid) return
    setSubmitting(true)
    setServerError('')
    setResult(null)
    try {
      const res = await importPhrasePlaylist(parsed, token)
      setResult(res)
    } catch (err) {
      setServerError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setText('')
    setResult(null)
    setServerError('')
  }

  async function copyExample() {
    try {
      await navigator.clipboard.writeText(EXAMPLE_JSON)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* noop */ }
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
          <Link to="/phrases" className="text-stone-500 hover:text-stone-800 text-sm font-semibold transition">
            ← Back to Phrases
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

      <main className="flex-1 max-w-4xl w-full mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-stone-800 tracking-tight">📥 Import phrases from JSON</h2>
          <p className="text-sm text-stone-400 mt-1">
            Paste a JSON payload to bulk-insert phrases. If a playlist with the same name and language already exists,
            new phrases are appended to it. Duplicates (same text in the same group) are skipped automatically.
          </p>
        </div>

        {/* Read-only example — no button to load it into the textarea */}
        <details className="mb-6 bg-stone-800 text-stone-100 rounded-2xl overflow-hidden">
          <summary className="cursor-pointer select-none px-5 py-3 flex items-center justify-between font-bold text-sm">
            <span>📋 Expected format (example)</span>
            <span className="text-[10px] text-stone-400 font-normal">click to expand · read-only</span>
          </summary>
          <div className="relative border-t border-stone-700">
            <button
              onClick={copyExample}
              className="absolute top-2 right-2 text-[11px] font-bold bg-stone-700 hover:bg-stone-600 text-stone-100 px-2 py-1 rounded transition"
              title="Copy example to clipboard"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <pre className="px-5 py-4 text-xs font-mono overflow-x-auto whitespace-pre">{EXAMPLE_JSON}</pre>
          </div>
          <p className="px-5 py-3 border-t border-stone-700 text-[11px] text-stone-400">
            ℹ️ This example is shown for reference. Nothing here gets inserted — you must write your own JSON in the textarea below.
          </p>
        </details>

        {/* Success result */}
        {result && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-emerald-800">
                  ✅ Import complete
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Playlist <span className="font-bold">"{result.playlist_name}"</span> {result.playlist_created ? 'created' : 'updated'}.
                  {' '}<span className="font-bold">{result.phrases_added}</span> phrases added
                  {result.phrases_skipped > 0 && <>, <span className="font-bold">{result.phrases_skipped}</span> skipped as duplicates</>}.
                </p>
              </div>
              <Link
                to={`/phrases/${result.playlist_id}`}
                className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition whitespace-nowrap"
              >
                Open playlist →
              </Link>
            </div>
            <ul className="text-xs text-emerald-700 space-y-1 mt-3 pt-3 border-t border-emerald-200">
              {result.groups.map((g, i) => (
                <li key={i}>
                  <span className="font-bold">{g.name}</span>
                  {g.created ? ' (new)' : ' (existing)'} — {g.phrases_added} added, {g.phrases_skipped} skipped
                </li>
              ))}
            </ul>
            <button onClick={handleReset} className="mt-4 text-xs text-emerald-700 font-bold underline hover:no-underline">
              Import another one
            </button>
          </div>
        )}

        {/* Textarea */}
        <div className="mb-3 flex items-center justify-between">
          <label className="text-sm font-bold text-stone-700">Your JSON</label>
          {text.trim() && (
            <button onClick={handleReset} className="text-xs text-stone-400 hover:text-stone-700 font-semibold transition">
              Clear
            </button>
          )}
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste your JSON here…"
          spellCheck={false}
          rows={16}
          className="w-full font-mono text-sm border border-stone-200 rounded-2xl p-4 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition resize-y bg-white"
        />

        {/* Validation feedback */}
        <div className="mt-3 min-h-[3rem]">
          {syntaxError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              <p className="font-bold mb-1">❌ JSON syntax error</p>
              <p className="text-xs font-mono">{syntaxError}</p>
            </div>
          ) : validationErrors.length > 0 ? (
            <div className="bg-orange-50 border border-orange-200 text-orange-700 text-sm rounded-xl px-4 py-3">
              <p className="font-bold mb-1">⚠️ Fix the following before importing:</p>
              <ul className="text-xs list-disc pl-4 space-y-0.5">
                {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          ) : text.trim() ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 flex items-center justify-between">
              <span>
                ✅ Valid — <span className="font-bold">{parsed?.groups?.length}</span>{' '}
                {parsed?.groups?.length === 1 ? 'group' : 'groups'} · <span className="font-bold">{totalPhrasesInPayload}</span>{' '}
                {totalPhrasesInPayload === 1 ? 'phrase' : 'phrases'}
              </span>
            </div>
          ) : (
            <p className="text-xs text-stone-400 italic px-1">Waiting for JSON input…</p>
          )}
        </div>

        {serverError && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <p className="font-bold">Server rejected the import</p>
            <p className="text-xs mt-0.5">{serverError}</p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-2xl transition shadow-sm shadow-emerald-900/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Importing…' : 'Import phrases'}
          </button>
        </div>
      </main>
    </div>
  )
}
