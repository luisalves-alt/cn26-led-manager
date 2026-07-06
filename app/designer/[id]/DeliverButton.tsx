'use client'

import { useState, useTransition } from 'react'
import { markDelivered } from '@/lib/actions'

export default function DeliverButton({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [pending, startTransition] = useTransition()

  function handleSubmit() {
    startTransition(async () => {
      await markDelivered(taskId, url)
      setOpen(false)
      setUrl('')
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded-xl bg-white text-black font-medium hover:bg-zinc-200 transition-colors whitespace-nowrap"
      >
        Entregar
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 items-end min-w-[220px]">
      <input
        autoFocus
        value={url}
        onChange={e => setUrl(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleSubmit()
          if (e.key === 'Escape') { setOpen(false); setUrl('') }
        }}
        placeholder="Cole o link aqui (opcional)"
        className="w-full text-xs bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 outline-none focus:border-zinc-500 text-zinc-200 placeholder:text-zinc-500"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setOpen(false); setUrl('') }}
          className="text-xs px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={handleSubmit}
          className="text-xs px-3 py-1.5 rounded-xl bg-white text-black font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {pending ? '...' : 'Confirmar'}
        </button>
      </div>
    </div>
  )
}
