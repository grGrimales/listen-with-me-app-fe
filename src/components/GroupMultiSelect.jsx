import { useState, useRef, useEffect, useMemo } from 'react'

// Searchable multi-select for phrase groups.
// `value` is an array of group ids; an empty array means "all groups" (the default).
// Works on both the light review page and the dark Zen setup via `variant`.

const THEMES = {
  light: {
    box:         'bg-white border-stone-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10',
    token:       'bg-emerald-50 text-emerald-800 border-emerald-200',
    tokenX:      'text-emerald-400 hover:text-emerald-800',
    input:       'text-stone-700 placeholder-stone-400',
    icon:        'text-stone-400 hover:text-stone-700',
    menu:        'bg-white border-stone-200 shadow-xl',
    option:      'text-stone-700 hover:bg-stone-50',
    optionOn:    'bg-emerald-50/60',
    optionHl:    'bg-stone-100',
    count:       'text-stone-400',
    empty:       'text-stone-400',
  },
  dark: {
    box:         'bg-stone-900 border-stone-700 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/20',
    token:       'bg-emerald-600/20 text-emerald-300 border-emerald-700',
    tokenX:      'text-emerald-500 hover:text-emerald-200',
    input:       'text-stone-200 placeholder-stone-600',
    icon:        'text-stone-600 hover:text-stone-300',
    menu:        'bg-stone-900 border-stone-700 shadow-2xl',
    option:      'text-stone-300 hover:bg-stone-800',
    optionOn:    'bg-emerald-600/10',
    optionHl:    'bg-stone-800',
    count:       'text-stone-600',
    empty:       'text-stone-600',
  },
}

export default function GroupMultiSelect({
  groups = [],
  value = [],
  onChange,
  variant = 'light',
  placeholder = 'All groups — type to search…',
}) {
  const t = THEMES[variant] || THEMES.light
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  const selected = useMemo(
    () => value.map(id => groups.find(g => g.id === id)).filter(Boolean),
    [value, groups]
  )

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups.filter(g => g.name.toLowerCase().includes(q))
  }, [groups, query])

  // Close when clicking anywhere outside the control.
  useEffect(() => {
    if (!open) return
    function onDocDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  // Add/remove a group. Clears the query so the full list is available again.
  function toggle(id) {
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id])
    setQuery('')
    setHighlight(0)
    inputRef.current?.focus()
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight(h => Math.min(h + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && matches[highlight]) { e.preventDefault(); toggle(matches[highlight].id) }
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Backspace' && query === '' && value.length > 0) {
      // Empty query: backspace peels off the last selected group.
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <div
        onClick={() => { setOpen(true); setHighlight(0); inputRef.current?.focus() }}
        className={`flex flex-wrap items-center gap-1.5 border rounded-xl px-2.5 py-2 cursor-text transition-all ${t.box}`}
      >
        {selected.map(g => (
          <span
            key={g.id}
            className={`flex items-center gap-1 border rounded-lg pl-2 pr-1 py-0.5 text-xs font-bold ${t.token}`}
          >
            {g.name}
            <span className="opacity-60 font-normal">({g.count})</span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); toggle(g.id) }}
              title={`Remove ${g.name}`}
              className={`ml-0.5 leading-none text-sm transition ${t.tokenX}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setHighlight(0); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={selected.length === 0 ? placeholder : 'Add another…'}
          className={`flex-1 min-w-[7rem] bg-transparent outline-none text-sm py-0.5 ${t.input}`}
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange([]); setQuery(''); setHighlight(0) }}
            title="Clear — back to all groups"
            className={`text-sm leading-none px-1 transition ${t.icon}`}
          >
            ✕
          </button>
        )}
        <svg className={`w-4 h-4 flex-shrink-0 ${t.icon}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && (
        <div className={`absolute z-30 mt-1 w-full max-h-56 overflow-y-auto border rounded-xl py-1 ${t.menu}`}>
          {matches.length === 0 ? (
            <p className={`px-3 py-2 text-sm ${t.empty}`}>No group matches "{query}"</p>
          ) : (
            matches.map((g, i) => {
              const on = value.includes(g.id)
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggle(g.id)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm transition ${t.option} ${on ? t.optionOn : ''} ${i === highlight ? t.optionHl : ''}`}
                >
                  <span className={`w-4 flex-shrink-0 ${on ? 'opacity-100' : 'opacity-0'}`}>✓</span>
                  <span className="flex-1 truncate font-semibold">{g.name}</span>
                  <span className={`text-xs ${t.count}`}>{g.count}</span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
