import PhraseStatsPage, { ZEN_LABELS } from './PhraseStatsPage'
import { getMyPhraseZenStatsDetailed, getPhraseZenLeaderboard } from '../api/phrases'

// Reuses the rich phrase-stats page, wired to the independent Zen-listen data.
export default function PhraseZenStatsPage() {
  return (
    <PhraseStatsPage
      fetchStats={getMyPhraseZenStatsDetailed}
      fetchLeaderboard={getPhraseZenLeaderboard}
      L={ZEN_LABELS}
    />
  )
}
