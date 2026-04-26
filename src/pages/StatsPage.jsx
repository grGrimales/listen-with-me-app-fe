import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserStats } from '../api/stories'

export default function StatsPage() {
  const { token } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const data = await getUserStats(token)
        setStats(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  if (loading) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 text-center max-w-md">
        <p className="text-5xl mb-4">❌</p>
        <h2 className="text-2xl font-bold text-stone-800 mb-2">Error</h2>
        <p className="text-stone-500 mb-6">{error}</p>
        <Link to="/" className="text-emerald-600 font-bold">Back to Library</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      <header className="bg-white border-b border-stone-200 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-stone-500 hover:text-stone-800 transition font-medium">← Library</Link>
          <h1 className="text-lg font-bold text-stone-800">Your Progress</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-emerald-600 rounded-[2rem] p-8 text-white shadow-xl shadow-emerald-900/10 flex flex-col items-center text-center">
            <span className="text-4xl mb-2">🏆</span>
            <span className="text-4xl font-black mb-1">{stats.total_reviews}</span>
            <span className="text-emerald-100 text-sm font-bold uppercase tracking-widest">Total Reviews</span>
          </div>
          <div className="bg-white rounded-[2rem] p-8 border border-stone-200 shadow-sm flex flex-col items-center text-center">
            <span className="text-4xl mb-2">📅</span>
            <span className="text-4xl font-black text-stone-800 mb-1">
              {stats.daily_reviews?.[0]?.count || 0}
            </span>
            <span className="text-stone-400 text-sm font-bold uppercase tracking-widest">Reviews Today</span>
          </div>
          <div className="bg-white rounded-[2rem] p-8 border border-stone-200 shadow-sm flex flex-col items-center text-center">
            <span className="text-4xl mb-2">📚</span>
            <span className="text-4xl font-black text-stone-800 mb-1">
              {stats.history_summary?.length || 0}
            </span>
            <span className="text-stone-400 text-sm font-bold uppercase tracking-widest">Stories Read</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Charts Column */}
          <div className="space-y-10">
            {/* Daily Reviews Chart */}
            <section>
              <h3 className="text-sm font-black text-stone-400 uppercase tracking-widest mb-6">Daily Activity (Last 30 Days)</h3>
              <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm">
                <div className="flex items-end justify-between h-40 gap-1 px-2">
                  {stats.daily_reviews?.slice().reverse().map((d, i) => {
                    const max = Math.max(...stats.daily_reviews.map(x => x.count), 1)
                    const height = (d.count / max) * 100
                    return (
                      <div key={d.period} className="flex-1 group relative">
                        <div 
                          style={{ height: `${height}%` }}
                          className={`w-full rounded-t-sm transition-all duration-500 ${i === stats.daily_reviews.length - 1 ? 'bg-emerald-600' : 'bg-emerald-200 group-hover:bg-emerald-400'}`}
                        />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-stone-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          {d.count} reviews on {d.period}
                        </div>
                      </div>
                    )
                  })}
                  {stats.daily_reviews?.length === 0 && (
                    <div className="w-full flex items-center justify-center text-stone-300 italic text-sm">No activity yet</div>
                  )}
                </div>
                <div className="flex justify-between mt-4 text-[10px] font-bold text-stone-400 uppercase tracking-tighter">
                  <span>Older</span>
                  <span>Today</span>
                </div>
              </div>
            </section>

            {/* Monthly / Yearly Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <section>
                <h3 className="text-sm font-black text-stone-400 uppercase tracking-widest mb-6">By Month</h3>
                <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm space-y-4">
                  {stats.monthly_reviews?.map(m => (
                    <div key={m.period} className="flex items-center gap-3">
                      <span className="text-[10px] font-mono font-bold text-stone-400 w-16">{m.period}</span>
                      <div className="flex-1 h-3 bg-stone-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${(m.count / Math.max(...stats.monthly_reviews.map(x => x.count), 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-black text-stone-600 w-4">{m.count}</span>
                    </div>
                  ))}
                  {stats.monthly_reviews?.length === 0 && <div className="text-stone-300 italic text-sm">No data</div>}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-black text-stone-400 uppercase tracking-widest mb-6">By Year</h3>
                <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm space-y-4">
                  {stats.yearly_reviews?.map(y => (
                    <div key={y.period} className="flex items-center gap-3">
                      <span className="text-[10px] font-mono font-bold text-stone-400 w-10">{y.period}</span>
                      <div className="flex-1 h-3 bg-stone-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-600 rounded-full"
                          style={{ width: `${(y.count / Math.max(...stats.yearly_reviews.map(x => x.count), 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-black text-stone-600 w-4">{y.count}</span>
                    </div>
                  ))}
                  {stats.yearly_reviews?.length === 0 && <div className="text-stone-300 italic text-sm">No data</div>}
                </div>
              </section>
            </div>
          </div>

          {/* History Column */}
          <section>
            <h3 className="text-sm font-black text-stone-400 uppercase tracking-widest mb-6">History by Story</h3>
            <div className="bg-white rounded-[2rem] border border-stone-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-stone-100">
                {stats.history_summary?.map(s => (
                  <Link 
                    key={s.story_id} 
                    to={`/stories/${s.story_id}`}
                    className="flex items-center justify-between p-5 hover:bg-stone-50 transition-colors group"
                  >
                    <div>
                      <h4 className="font-bold text-stone-800 group-hover:text-emerald-700 transition-colors">{s.title}</h4>
                      <p className="text-xs text-stone-400">Last reviewed: {new Date(s.last_reviewed).toLocaleDateString()}</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter mb-1">
                        {s.review_count} {s.review_count === 1 ? 'review' : 'reviews'}
                      </span>
                    </div>
                  </Link>
                ))}
                {stats.history_summary?.length === 0 && (
                  <div className="p-10 text-center text-stone-400 italic">
                    You haven't marked any stories as reviewed yet.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
