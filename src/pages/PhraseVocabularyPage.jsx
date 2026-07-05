import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getPhraseVocabularyInfo } from '../api/phrases'

// This page is kept only as a smart redirect target for bookmarked URLs.
// The primary way to reach a vocab playlist is via the parent playlist's 📗 Vocab link,
// which navigates directly to /phrases/{childId}.
export default function PhraseVocabularyPage() {
  const { id } = useParams()
  const { token } = useAuth()
  const [state, setState] = useState({ loading: true, childId: null, error: '' })

  useEffect(() => {
    getPhraseVocabularyInfo(id, token)
      .then(info => setState({ loading: false, childId: info.child_playlist_id ?? null, error: '' }))
      .catch(err => setState({ loading: false, childId: null, error: err.message }))
  }, [id, token])

  if (state.loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
      </div>
    )
  }

  if (state.childId) return <Navigate to={`/phrases/${state.childId}`} replace />

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center">
      <span className="text-5xl mb-4">✨</span>
      <h3 className="text-xl font-bold text-stone-800 mb-2">No vocabulary yet</h3>
      <p className="text-stone-500 max-w-md mb-4">
        {state.error || 'Highlight any word in the target language while reviewing to save it here.'}
      </p>
      <Link
        to={`/phrases/${id}`}
        className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl transition"
      >
        Go to playlist
      </Link>
    </div>
  )
}
