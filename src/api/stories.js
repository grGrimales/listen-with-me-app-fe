const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8082'

async function request(path, token, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  console.log(`[API Request] ${options.method || 'GET'} ${BASE_URL}${path}`)
  
  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
    console.log(`[API Response] Status: ${res.status}`)
    
    let data
    const contentType = res.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      data = await res.json()
    } else {
      const text = await res.text()
      data = { error: text || res.statusText }
    }

    if (!res.ok) {
      console.error('[API Error Data]', data)
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('api:unauthorized'))
      }
      throw new Error(data.error || 'Something went wrong')
    }
    return data
  } catch (err) {
    console.error('[API Fetch Error]', err)
    throw err
  }
}

export const getStories = (token, { playlistId, sortBy, limit = 12, offset = 0 } = {}) => {
  const params = new URLSearchParams()
  if (playlistId) params.set('playlist_id', playlistId)
  if (sortBy)     params.set('sort_by', sortBy)
  params.set('limit', limit)
  params.set('offset', offset)
  return request(`/api/stories?${params}`, token)
}
export const getDeletedStories = (token) => request('/api/admin/stories/trash-items', token)
export const getStory = (id, token) => request(`/api/stories/${id}`, token)

export const deleteStory = (id, token) => request(`/api/stories/${id}`, token, { method: 'DELETE' })
export const restoreStory = (id, token) => request(`/api/stories/${id}/restore`, token, { method: 'POST' })
export const updateStory = (id, storyData, token) => request(`/api/stories/${id}`, token, {
  method: 'PUT',
  body: JSON.stringify(storyData)
})
export const publishStory = (id, token) => request(`/api/stories/${id}/publish`, token, { method: 'POST' })

export async function uploadVoiceAudio(storyId, name, file, token) {
  const formData = new FormData()
  formData.append('name', name)
  formData.append('file', file)
  const res = await fetch(`${BASE_URL}/api/stories/${storyId}/voices/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data
}

export async function uploadParagraphAudio(paragraphId, file, token) {
  const formData = new FormData()
  formData.append('file', file)
  // No Content-Type header — browser sets multipart boundary automatically
  const res = await fetch(`${BASE_URL}/api/paragraphs/${paragraphId}/audio/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data
}

export const deleteParagraphAudio = (paragraphId, token) => 
  request(`/api/paragraphs/${paragraphId}/audio`, token, { method: 'DELETE' })

export async function uploadParagraphImage(paragraphId, file, token) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${BASE_URL}/api/paragraphs/${paragraphId}/images/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data
}

export const deleteParagraphImage = (imageId, token) => 
  request(`/api/paragraphs/images/${imageId}`, token, { method: 'DELETE' })

export const markStoryAsReviewed = (id, token) => request(`/api/stories/${id}/review`, token, { method: 'POST' })
export const getUserStats = (token) => request('/api/stats', token)

// Playlists
export const getPlaylists = (token) => request('/api/playlists', token)
export const createPlaylist = (data, token) => request('/api/playlists', token, {
  method: 'POST',
  body: JSON.stringify(data)
})
export const updatePlaylist = (id, data, token) => request(`/api/playlists/${id}`, token, {
  method: 'PUT',
  body: JSON.stringify(data)
})
export const deletePlaylist = (id, token) => request(`/api/playlists/${id}`, token, { method: 'DELETE' })
export const setPlaylistFavorite = (id, isFavorite, token) => request(`/api/playlists/${id}`, token, {
  method: 'PATCH',
  body: JSON.stringify({ is_favorite: isFavorite }),
})
export const addStoryToPlaylist = (playlistId, storyId, token) => request(`/api/playlists/${playlistId}/stories`, token, {
  method: 'POST',
  body: JSON.stringify({ story_id: storyId })
})
export const removeStoryFromPlaylist = (playlistId, storyId, token) => 
  request(`/api/playlists/${playlistId}/stories/${storyId}`, token, { method: 'DELETE' })

// User Vocabulary
export const getUserVocabulary = (storyId, token) => request(`/api/stories/${storyId}/vocabulary`, token)
export const addUserVocabulary = (storyId, phrase, token) => request(`/api/stories/${storyId}/vocabulary`, token, {
  method: 'POST',
  body: JSON.stringify({ phrase })
})
export const deleteUserVocabulary = (id, token) => request(`/api/stories/vocabulary/${id}`, token, { method: 'DELETE' })

// Zen Mode
export const getZenStories = (token, { playlistId, limit, sort } = {}) => {
  const params = new URLSearchParams()
  if (playlistId) params.set('playlist_id', playlistId)
  if (limit) params.set('limit', limit)
  if (sort) params.set('sort', sort)
  const qs = params.toString()
  return request(`/api/zen/stories${qs ? `?${qs}` : ''}`, token)
}
export const logZenListen = (storyId, token) => request('/api/zen/listen', token, {
  method: 'POST',
  body: JSON.stringify({ story_id: storyId })
})
