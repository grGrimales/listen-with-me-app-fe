const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8082'

async function request(path, token, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

export const getStories = (token) => request('/api/stories', token)
export const getStory = (id, token) => request(`/api/stories/${id}`, token)
export const deleteStory = (id, token) => request(`/api/stories/${id}`, token, { method: 'DELETE' })
export const updateStory = (id, storyData, token) => request(`/api/stories/${id}`, token, {
  method: 'PUT',
  body: JSON.stringify(storyData)
})
export const publishStory = (id, token) => request(`/api/stories/${id}/publish`, token, { method: 'POST' })
