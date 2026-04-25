import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { saveAuth } = useAuth()
  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await register(form.fullName, form.email, form.password)
      saveAuth(data.token, data.user)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-amber-50 flex">
      {/* Panel izquierdo decorativo */}
      <div className="hidden lg:flex lg:w-1/2 bg-emerald-700 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎧</span>
          <span className="text-white text-xl font-bold tracking-tight">Listen With Me</span>
        </div>
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <span className="text-2xl mt-0.5">📖</span>
            <div>
              <p className="text-white font-semibold">Real stories</p>
              <p className="text-emerald-200 text-sm mt-1">
                Hand-picked stories at every level — beginner to advanced.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <span className="text-2xl mt-0.5">🔊</span>
            <div>
              <p className="text-white font-semibold">Native audio</p>
              <p className="text-emerald-200 text-sm mt-1">
                Listen, pause, and replay at your own pace.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <span className="text-2xl mt-0.5">📈</span>
            <div>
              <p className="text-white font-semibold">Track your progress</p>
              <p className="text-emerald-200 text-sm mt-1">
                See which stories you've completed and how far you've come.
              </p>
            </div>
          </div>
        </div>
        <p className="text-emerald-400 text-sm">Free to start. No credit card required.</p>
      </div>

      {/* Panel derecho con formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <span className="text-2xl">🎧</span>
            <span className="text-emerald-700 text-lg font-bold">Listen With Me</span>
          </div>

          <h2 className="text-3xl font-bold text-stone-800 tracking-tight">Start learning today</h2>
          <p className="mt-2 text-stone-500">Create your free account in seconds.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Full name
              </label>
              <input
                type="text"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                required
                placeholder="Jane Doe"
                className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="you@example.com"
                className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition shadow-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                placeholder="At least 6 characters"
                className="w-full bg-white border border-stone-300 rounded-xl px-4 py-3 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition shadow-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition shadow-sm"
            >
              {loading ? 'Creating account…' : 'Create free account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone-500">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-600 hover:text-emerald-500 font-medium transition">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
