const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8082'

async function request(path, token, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  let data
  const ct = res.headers.get('content-type')
  if (ct && ct.includes('application/json')) data = await res.json()
  else data = { error: (await res.text()) || res.statusText }
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new CustomEvent('api:unauthorized'))
    throw new Error(data.error || 'Something went wrong')
  }
  return data
}

export function listPhrasePlaylists(token, language) {
  const qs = language ? `?language=${encodeURIComponent(language)}` : ''
  return request(`/api/phrase-playlists${qs}`, token)
}

export function getPhrasePlaylist(id, token) {
  return request(`/api/phrase-playlists/${id}`, token)
}

export function seedDummyPhrasePlaylists(token) {
  return request('/api/phrase-playlists/seed-dummy', token, { method: 'POST' })
}

export function importPhrasePlaylist(payload, token) {
  return request('/api/phrase-playlists/import', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function setPhrasePlaylistFavorite(id, isFavorite, token) {
  return request(`/api/phrase-playlists/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ is_favorite: isFavorite }),
  })
}

export function logPhraseReview(phraseId, token) {
  return request(`/api/phrases/${phraseId}/review`, token, { method: 'POST' })
}

export function ratePhrase(phraseId, quality, token) {
  return request(`/api/phrases/${phraseId}/rate`, token, {
    method: 'POST',
    body: JSON.stringify({ quality }),
  })
}

export function updatePhrase(phraseId, data, token) {
  return request(`/api/phrases/${phraseId}`, token, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deletePhrase(phraseId, token) {
  return request(`/api/phrases/${phraseId}`, token, { method: 'DELETE' })
}

export function updatePhraseGroup(groupId, name, token) {
  return request(`/api/phrase-groups/${groupId}`, token, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
}

export function deletePhraseGroup(groupId, token) {
  return request(`/api/phrase-groups/${groupId}`, token, { method: 'DELETE' })
}

export function generatePollyAudio(phraseId, voice, token) {
  return request(`/api/phrases/${phraseId}/audio/polly?voice=${voice}`, token, { method: 'POST' })
}

// Returns { child_playlist_id, phrase_count }
export function getPhraseVocabularyInfo(parentPlaylistId, token) {
  return request(`/api/phrase-playlists/${parentPlaylistId}/vocabulary`, token)
}

// Returns { child_playlist_id, phrase_id, child_created, phrase_created }
export function addPhraseVocabulary(parentPlaylistId, text, sourcePhraseId, token) {
  return request(`/api/phrase-playlists/${parentPlaylistId}/vocabulary`, token, {
    method: 'POST',
    body: JSON.stringify({ text, source_phrase_id: sourcePhraseId }),
  })
}

export function getPhraseLeaderboard(token, limit = 10) {
  return request(`/api/phrase-stats/leaderboard?limit=${limit}`, token)
}

export function getMyPhraseStats(token) {
  return request('/api/phrase-stats/me', token)
}

export function getMyPhraseStatsDetailed(token) {
  return request('/api/phrase-stats/me/detailed', token)
}

export function listPlaylistShares(playlistId, token) {
  return request(`/api/phrase-playlists/${playlistId}/shares`, token)
}

export function searchShareCandidates(playlistId, q, token) {
  return request(`/api/phrase-playlists/${playlistId}/share-candidates?q=${encodeURIComponent(q)}`, token)
}

export function addPlaylistShare(playlistId, email, permission, token) {
  return request(`/api/phrase-playlists/${playlistId}/shares`, token, {
    method: 'POST',
    body: JSON.stringify({ email, permission }),
  })
}

export function updatePlaylistShare(playlistId, userId, permission, token) {
  return request(`/api/phrase-playlists/${playlistId}/shares/${userId}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ permission }),
  })
}

export function removePlaylistShare(playlistId, userId, token) {
  return request(`/api/phrase-playlists/${playlistId}/shares/${userId}`, token, {
    method: 'DELETE',
  })
}
