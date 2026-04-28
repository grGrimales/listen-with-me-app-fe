const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8082'

async function request(path, token, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

export const getTTSVoices = (token) => request('/api/tts/voices', token)
export const getTTSModels = (token) => request('/api/tts/models', token)

export const generateParagraphAudio = (paragraphId, voiceId, modelId, token) =>
  request(`/api/paragraphs/${paragraphId}/audio/generate`, token, {
    method: 'POST',
    body: JSON.stringify({ voice_id: voiceId, model_id: modelId }),
  })

export const getParagraphAudioHistory = (paragraphId, token) =>
  request(`/api/paragraphs/${paragraphId}/audio/history`, token)

export const restoreParagraphAudio = (paragraphId, historyId, token) =>
  request(`/api/paragraphs/${paragraphId}/audio/restore`, token, {
    method: 'POST',
    body: JSON.stringify({ history_id: historyId }),
  })
