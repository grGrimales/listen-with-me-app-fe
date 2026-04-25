import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getStory, updateStory, uploadParagraphAudio } from '../api/stories'

export default function AssetsManagerPage() {
  const { id } = useParams()
  const { token } = useAuth()
  const [story, setStory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { loadStory() }, [id])

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
        ...p,
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

  async function handleUpdateParagraphImage(pId, imageUrl) {
    setError('')
    const updated = {
      ...story,
      paragraphs: story.paragraphs.map(p => {
        const base = p.id === pId ? { ...p, image_url: imageUrl } : p
        return {
          ...base,
          translations: base.translations.map(t => ({ language: t.language, content: t.content })),
          vocabulary: base.vocabulary.map(v => ({ word: v.word, definition: v.definition })),
        }
      }),
    }
    try {
      await updateStory(id, updated, token)
      notify('Image updated!')
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
                onImageSave={(url) => handleUpdateParagraphImage(p.id, url)}
                onAudioUploaded={() => { loadStory(); notify('Audio uploaded!') }}
                onError={setError}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function ParagraphAssetCard({ paragraph: p, index, token, onImageSave, onAudioUploaded, onError }) {
  const imgInputRef = useRef(null)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-100 flex items-center gap-3">
        <span className="w-7 h-7 rounded-full bg-stone-100 text-stone-500 text-sm font-semibold flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <p className="text-sm text-stone-600 line-clamp-1">"{p.content}"</p>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Image */}
        <div>
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Image</p>
          <div className="flex gap-3 items-start">
            <div className="w-20 h-20 bg-stone-100 rounded-xl overflow-hidden flex-shrink-0">
              {p.image_url
                ? <img src={p.image_url} className="w-full h-full object-cover" alt="" />
                : <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs text-center leading-tight px-1">No image</div>
              }
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={imgInputRef}
                defaultValue={p.image_url}
                placeholder="https://..."
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm"
              />
              <button
                onClick={() => onImageSave(imgInputRef.current.value)}
                className="w-full bg-stone-700 text-white px-3 py-1.5 rounded-xl text-sm hover:bg-stone-600 transition"
              >
                Save image
              </button>
            </div>
          </div>
        </div>

        {/* Audio */}
        <div>
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Audio</p>
          {p.audio_url ? (
            <div className="space-y-3">
              <audio src={p.audio_url} controls className="w-full h-9" />
              <p className="text-xs text-stone-400 truncate">{p.audio_url}</p>
              <AudioUploadButton paragraphId={p.id} token={token} onSuccess={onAudioUploaded} onError={onError} label="Replace audio" />
            </div>
          ) : (
            <AudioUploadButton paragraphId={p.id} token={token} onSuccess={onAudioUploaded} onError={onError} label="Upload audio" />
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
      {/* Drop zone — also opens file picker on click */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`
          relative flex flex-col items-center justify-center gap-1
          border-2 border-dashed rounded-xl px-4 py-5 cursor-pointer
          transition-colors select-none
          ${dragging
            ? 'border-emerald-400 bg-emerald-50'
            : file
              ? 'border-emerald-300 bg-emerald-50/50'
              : 'border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-stone-100'
          }
        `}
      >
        <svg className={`w-6 h-6 ${dragging || file ? 'text-emerald-500' : 'text-stone-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l3-3m0 0l3 3m-3-3v12M5.25 19.5h13.5" />
        </svg>
        {file ? (
          <p className="text-xs text-emerald-700 font-medium text-center">
            {file.name}<br />
            <span className="text-emerald-500 font-normal">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          </p>
        ) : (
          <p className="text-xs text-stone-400 text-center">
            {dragging ? 'Drop to select' : 'Drop audio or click to browse'}
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
        className="w-full bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-sm font-medium hover:bg-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? 'Uploading…' : label}
      </button>
    </div>
  )
}
