// Sort modes shared by the phrase review deck and the phrase search page.
export const SORT_OPTIONS = [
  { value: 'playlist',       label: '📋 Playlist order' },
  { value: 'newest',         label: '🆕 Newest first' },
  { value: 'oldest',         label: '🕰️ Oldest first' },
  { value: 'least_reviewed', label: '📉 Least reviewed' },
  { value: 'random',         label: '🎲 Random' },
  { value: 'srs',            label: '🧠 Smart review (SRS)' },
]

// Simple deterministic shuffle
export function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
