import { useState } from 'react'

export function WidgetDemo() {
  const [feedback, setFeedback] = useState(false)

  const handleWidgetAction = () => {
    setFeedback(true)
    setTimeout(() => setFeedback(false), 1200)
  }

  return (
    <div className="relative">
      <div
        onClick={handleWidgetAction}
        className={[
          'm-10 flex h-24 w-24 items-center justify-center rounded-xl border text-sm font-medium transition-colors',
          feedback
            ? 'border-emerald-300/60 bg-emerald-300 text-zinc-950'
            : 'border-cyan-300/40 bg-cyan-200 text-zinc-950',
        ].join(' ')}
      >
        Widget
        {feedback && (
          <span className="pointer-events-none absolute left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-3 py-1 text-xs font-semibold text-zinc-100 shadow-lg shadow-black/30">
            Used!
          </span>
        )}
      </div>
    </div>
  )
}
