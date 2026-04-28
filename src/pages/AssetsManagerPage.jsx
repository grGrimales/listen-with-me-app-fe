import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getStory, updateStory, uploadParagraphAudio, deleteParagraphAudio, uploadParagraphImage, deleteParagraphImage } from '../api/stories'
import { getTTSVoices, getTTSModels, generateParagraphAudio, getParagraphAudioHistory, restoreParagraphAudio } from '../api/tts'

export default function AssetsManagerPage() {
  const { id } = useParams()
  const { token } = useAuth()
  const [story, setStory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [ttsVoices, setTtsVoices] = useState([])
  const [ttsModels, setTtsModels] = useState([])

  useEffect(() => { loadStory() }, [id])

  useEffect(() => {
    getTTSVoices(token).then(setTtsVoices).catch(() => {})
    getTTSModels(token).then(setTtsModels).catch(() => {})
  }, [token])

  async function loadStory() {
    try {
      const data = await getStory(id, token)
      setStory(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function notify(msg) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  async function handleDeleteAudio(pId) {
    if (!window.confirm('Are you sure you want to delete this audio?')) return
    setError('')
    try {
      await deleteParagraphAudio(pId, token)
      notify('Audio deleted!')
      loadStory()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleUpdateMetadata(e) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.target)
    const updated = {
      ...story,
      title: fd.get('title'),
      level: fd.get('level'),
      author: fd.get('author'),
      cover_url: fd.get('cover_url'),
      category_id: parseInt(fd.get('category_id')),
      paragraphs: story.paragraphs.map(p => ({
        position: p.position,
        content: p.content,
        audio_url: p.audio_url,
        images: p.images?.map(img => img.image_url) || [],
        translations: p.translations.map(t => ({ language: t.language, content: t.content })),
        vocabulary: p.vocabulary.map(v => ({ word: v.word, definition: v.definition })),
      })),
    }
    try {
      await updateStory(id, updated, token)
      notify('Metadata updated!')
      loadStory()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteImage(imgId) {
    if (!window.confirm('Are you sure you want to delete this image?')) return
    setError('')
    try {
      await deleteParagraphImage(imgId, token)
      notify('Image deleted!')
      loadStory()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <div className="p-10 text-center">Loading...</div>

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-stone-800">Assets Manager</h1>
            <p className="text-stone-500">Images &amp; audio for "{story.title}"</p>
          </div>
          <Link to="/" className="text-emerald-600 font-medium">← Back</Link>
        </header>

        {success && (
          <div className="mb-6 bg-emerald-100 text-emerald-700 p-4 rounded-xl font-medium">{success}</div>
        )}
        {error && (
          <div className="mb-6 bg-red-100 text-red-700 p-4 rounded-xl font-medium">{error}</div>
        )}

        {/* Story metadata */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 mb-8">
          <h2 className="text-xl font-bold text-stone-800 mb-6">Main Assets</h2>
          <form onSubmit={handleUpdateMetadata} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-stone-700 mb-1">Story Title</label>
              <input name="title" defaultValue={story.title} className="w-full border border-stone-300 rounded-xl px-4 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Author</label>
              <input name="author" defaultValue={story.author} className="w-full border border-stone-300 rounded-xl px-4 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Level</label>
              <select name="level" defaultValue={story.level} className="w-full border border-stone-300 rounded-xl px-4 py-2">
                {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-stone-700 mb-1">Cover Image URL</label>
              <input name="cover_url" defaultValue={story.cover_url} className="w-full border border-stone-300 rounded-xl px-4 py-2" placeholder="https://..." />
            </div>
            <input type="hidden" name="category_id" value={story.category_id} />
            <div className="md:col-span-2">
              <button type="submit" className="bg-stone-800 text-white px-6 py-2 rounded-xl hover:bg-stone-700 transition">
                Update Metadata
              </button>
            </div>
          </form>
        </section>

        {/* Paragraphs — image + audio per paragraph */}
        <section>
          <h2 className="text-xl font-bold text-stone-800 mb-4">Paragraphs</h2>
          <div className="space-y-6">
            {story.paragraphs.map((p, i) => (
              <ParagraphAssetCard
                key={p.id}
                paragraph={p}
                index={i}
                token={token}
                ttsVoices={ttsVoices}
                ttsModels={ttsModels}
                onAudioUploaded={() => { loadStory(); notify('Audio uploaded!') }}
                onAudioDeleted={() => handleDeleteAudio(p.id)}
                onAudioGenerated={() => { loadStory(); notify('Audio generated!') }}
                onImageUploaded={() => { loadStory(); notify('Image uploaded!') }}
                onImageDeleted={(imgId) => handleDeleteImage(imgId)}
                onError={setError}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function ParagraphAssetCard({ paragraph: p, index, token, ttsVoices, ttsModels, onAudioUploaded, onAudioDeleted, onAudioGenerated, onImageUploaded, onImageDeleted, onError }) {
  const [showTTSModal, setShowTTSModal] = useState(false)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-100 flex items-center gap-3">
        <span className="w-7 h-7 rounded-full bg-stone-100 text-stone-500 text-sm font-semibold flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <p className="text-sm text-stone-600 line-clamp-1">"{p.content}"</p>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Images Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Images ({p.images?.length || 0}/5)</p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {p.images?.map((img) => (
              <div key={img.id} className="relative aspect-square bg-stone-100 rounded-xl overflow-hidden group">
                <img src={img.image_url} className="w-full h-full object-cover" alt="" />
                <button
                  onClick={() => onImageDeleted(img.id)}
                  className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition shadow-sm"
                  title="Delete image"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {[...Array(5 - (p.images?.length || 0))].map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square border-2 border-dashed border-stone-200 rounded-xl flex items-center justify-center text-stone-300">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6.75a1.5 1.5 0 00-1.5-1.5H2.25A1.5 1.5 0 00.75 6.75v10.5a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
            ))}
          </div>

          {(p.images?.length || 0) < 5 ? (
            <ImageUploadButton paragraphId={p.id} token={token} onSuccess={onImageUploaded} onError={onError} />
          ) : (
            <p className="text-xs text-amber-600 font-medium text-center bg-amber-50 py-2 rounded-xl">Maximum images reached</p>
          )}
        </div>

        {/* Audio Section */}
        <div>
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-4">Audio</p>
          {p.audio_url ? (
            <div className="space-y-4">
              <audio src={p.audio_url} controls className="w-full h-10" />
              <div className="flex items-center gap-2 bg-stone-50 p-2 rounded-xl border border-stone-100">
                <p className="text-[10px] text-stone-400 truncate flex-1 font-mono">{p.audio_url}</p>
                <button
                  onClick={onAudioDeleted}
                  className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-100 transition"
                  title="Delete audio"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <AudioUploadButton paragraphId={p.id} token={token} onSuccess={onAudioUploaded} onError={onError} label="Replace audio" />
              <button
                onClick={() => setShowTTSModal(true)}
                className="w-full border border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-2 rounded-xl text-xs font-bold transition"
              >
                Regenerate with AI
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <AudioUploadButton paragraphId={p.id} token={token} onSuccess={onAudioUploaded} onError={onError} label="Upload audio" />
              <button
                onClick={() => setShowTTSModal(true)}
                className="w-full border border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-2 rounded-xl text-xs font-bold transition"
              >
                Generate with AI
              </button>
            </div>
          )}
        </div>
      </div>

      {showTTSModal && (
        <TTSGenerateModal
          paragraphId={p.id}
          token={token}
          voices={ttsVoices}
          models={ttsModels}
          onSuccess={() => { setShowTTSModal(false); onAudioGenerated() }}
          onError={(msg) => { setShowTTSModal(false); onError(msg) }}
          onClose={() => setShowTTSModal(false)}
        />
      )}
    </div>
  )
}

function ImageUploadButton({ paragraphId, token, onSuccess, onError }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)
  const dragCounter = useRef(0)

  function pickFile(f) {
    if (f && f.type.startsWith('image/')) {
      setFile(f)
      onError('')
    } else if (f) {
      onError('Please select an image file (PNG, JPG, etc.)')
    }
  }

  function onDragEnter(e) {
    e.preventDefault()
    dragCounter.current++
    setDragging(true)
  }

  function onDragLeave(e) {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }

  function onDragOver(e) { e.preventDefault() }

  function onDrop(e) {
    e.preventDefault()
    dragCounter.current = 0
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    onError('')
    try {
      await uploadParagraphImage(paragraphId, file, token)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      onSuccess()
    } catch (err) {
      onError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => fileRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`
          relative flex flex-col items-center justify-center gap-2
          border-2 border-dashed rounded-2xl px-4 py-6 cursor-pointer
          transition-all select-none
          ${dragging
            ? 'border-emerald-400 bg-emerald-50 scale-[1.02]'
            : file
              ? 'border-emerald-300 bg-emerald-50/50'
              : 'border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-stone-100'
          }
        `}
      >
        <svg className={`w-8 h-8 ${dragging || file ? 'text-emerald-500' : 'text-stone-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6.75a1.5 1.5 0 00-1.5-1.5H2.25A1.5 1.5 0 00.75 6.75v10.5a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
        
        {file ? (
          <div className="text-center">
            <p className="text-xs text-emerald-700 font-bold truncate max-w-[150px]">{file.name}</p>
            <p className="text-[10px] text-emerald-500">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
        ) : (
          <p className="text-xs text-stone-400 text-center font-medium">
            {dragging ? 'Drop image here' : 'Drop image or click to browse'}
          </p>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => pickFile(e.target.files[0])}
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500 transition shadow-sm disabled:opacity-50 disabled:grayscale"
      >
        {uploading ? 'Uploading Image...' : 'Confirm Upload'}
      </button>
    </div>
  )
}

function TTSGenerateModal({ paragraphId, token, voices, models, onSuccess, onError, onClose }) {
  const [voiceId, setVoiceId] = useState(voices[0]?.id || '')
  const [modelId, setModelId] = useState(models[0]?.id || '')
  const [generating, setGenerating] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [restoring, setRestoring] = useState(null)

  async function handleGenerate() {
    if (!voiceId || !modelId) return
    setGenerating(true)
    try {
      await generateParagraphAudio(paragraphId, voiceId, modelId, token)
      onSuccess()
    } catch (err) {
      onError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const data = await getParagraphAudioHistory(paragraphId, token)
      setHistory(data)
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  function toggleHistory() {
    const next = !showHistory
    setShowHistory(next)
    if (next && history.length === 0) loadHistory()
  }

  async function handleRestore(historyId) {
    setRestoring(historyId)
    try {
      await restoreParagraphAudio(paragraphId, historyId, token)
      onSuccess()
    } catch (err) {
      onError(err.message)
    } finally {
      setRestoring(null)
    }
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-stone-800">Generate Audio with AI</h3>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Voice</label>
              {voices.length === 0 ? (
                <p className="text-sm text-stone-400 italic">No voices available</p>
              ) : (
                <select
                  value={voiceId}
                  onChange={e => setVoiceId(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  {voices.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Model</label>
              {models.length === 0 ? (
                <p className="text-sm text-stone-400 italic">No models available</p>
              ) : (
                <select
                  value={modelId}
                  onChange={e => setModelId(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 border border-stone-300 text-stone-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-stone-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || !voiceId || !modelId}
                className="flex-1 bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-violet-500 transition disabled:opacity-50 disabled:grayscale"
              >
                {generating ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>
        </div>

        {/* History section */}
        <div className="border-t border-stone-100">
          <button
            onClick={toggleHistory}
            className="w-full flex items-center justify-between px-6 py-3 text-sm font-medium text-stone-500 hover:bg-stone-50 transition"
          >
            <span>Audio history</span>
            <svg
              className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showHistory && (
            <div className="px-6 pb-6 space-y-3">
              {historyLoading && (
                <p className="text-sm text-stone-400 text-center py-2">Loading…</p>
              )}
              {!historyLoading && history.length === 0 && (
                <p className="text-sm text-stone-400 text-center py-2">No history yet</p>
              )}
              {!historyLoading && history.map(entry => (
                <div key={entry.id} className="bg-stone-50 rounded-xl p-3 space-y-2 border border-stone-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-stone-700">{entry.voice_name || '—'} · {entry.model_id}</p>
                      <p className="text-[10px] text-stone-400">{formatDate(entry.created_at)}</p>
                    </div>
                    <button
                      onClick={() => handleRestore(entry.id)}
                      disabled={restoring === entry.id}
                      className="text-xs font-bold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-1 rounded-lg transition disabled:opacity-50"
                    >
                      {restoring === entry.id ? '…' : 'Restore'}
                    </button>
                  </div>
                  <audio src={entry.audio_url} controls className="w-full h-8" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AudioUploadButton({ paragraphId, token, onSuccess, onError, label }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)
  const dragCounter = useRef(0)

  function pickFile(f) {
    if (f && f.type.startsWith('audio/')) setFile(f)
  }

  function onDragEnter(e) {
    e.preventDefault()
    dragCounter.current++
    setDragging(true)
  }

  function onDragLeave(e) {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }

  function onDragOver(e) { e.preventDefault() }

  function onDrop(e) {
    e.preventDefault()
    dragCounter.current = 0
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    onError('')
    try {
      await uploadParagraphAudio(paragraphId, file, token)
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      onSuccess()
    } catch (err) {
      onError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => fileRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`
          relative flex flex-col items-center justify-center gap-1
          border-2 border-dashed rounded-xl px-4 py-4 cursor-pointer
          transition-colors select-none
          ${dragging
            ? 'border-emerald-400 bg-emerald-50'
            : file
              ? 'border-emerald-300 bg-emerald-50/50'
              : 'border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-stone-100'
          }
        `}
      >
        <svg className={`w-5 h-5 ${dragging || file ? 'text-emerald-500' : 'text-stone-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l3-3m0 0l3 3m-3-3v12M5.25 19.5h13.5" />
        </svg>
        {file ? (
          <p className="text-[10px] text-emerald-700 font-medium text-center truncate w-full px-2">
            {file.name}
          </p>
        ) : (
          <p className="text-[10px] text-stone-400 text-center">
            {dragging ? 'Drop audio' : 'Drop or browse audio'}
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={e => pickFile(e.target.files[0])}
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="w-full bg-stone-800 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-stone-700 transition disabled:opacity-50"
      >
        {uploading ? 'Uploading…' : label}
      </button>
    </div>
  )
}
