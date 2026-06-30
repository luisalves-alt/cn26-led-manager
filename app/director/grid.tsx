'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import { markApproved, requestRevision } from '@/lib/actions'
import type { DirectorRow, DeliveryStatus } from '@/types'

function driveUrl(id: string) {
  return `https://drive.google.com/drive/folders/${id}`
}

function StatusBadge({ status }: { status: DeliveryStatus | null }) {
  if (!status || status === 'pending') {
    return <span className="inline-flex items-center gap-1.5 text-xs text-zinc-600"><span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />Pendente</span>
  }
  const map: Record<string, { label: string; dot: string; cls: string }> = {
    delivered: { label: 'Entregue', dot: 'bg-amber-400',   cls: 'text-amber-400' },
    revision:  { label: 'Revisão',  dot: 'bg-orange-400',  cls: 'text-orange-400' },
    approved:  { label: 'Aprovado', dot: 'bg-emerald-400', cls: 'text-emerald-400' },
  }
  const s = map[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function RowActions({ row }: { row: DirectorRow }) {
  const [revising, setRevising] = useState(false)
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  if (row.status === 'revision' && row.revisionNote && !revising) {
    return <p className="text-xs text-orange-300/70 italic max-w-xs">{row.revisionNote}</p>
  }

  if (row.status !== 'delivered') return null

  if (revising) {
    return (
      <div className="flex items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="O que mudar?"
          className="w-40 text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 outline-none focus:border-zinc-500"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => {
            await requestRevision(row.deliveryId!, note)
            setRevising(false)
            setNote('')
          })}
          className="text-xs px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded-lg font-medium transition-colors">
          {pending ? '...' : 'Enviar'}
        </button>
        <button type="button" onClick={() => { setRevising(false); setNote('') }}
          className="text-xs px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">×</button>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <form action={markApproved.bind(null, row.deliveryId!)}>
        <button type="submit"
          className="text-xs px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-600/40 text-emerald-400 rounded-lg font-medium transition-colors">
          Aprovar
        </button>
      </form>
      <button type="button" onClick={() => setRevising(true)}
        className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 rounded-lg font-medium transition-colors">
        Revisão
      </button>
    </div>
  )
}

interface Props {
  eventName: string
  driveFolderId: string | null
  rows: DirectorRow[]
  allDayLabels: string[]
}

export default function DirectorGrid({ eventName, driveFolderId, rows, allDayLabels }: Props) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createBrowserClient()
    const channel = supabase
      .channel('led-deliveries-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'led_deliveries' }, () => {
        router.refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [router])

  const totalTasks = rows.length
  const approved = rows.filter(r => r.status === 'approved').length
  const delivered = rows.filter(r => r.status === 'delivered').length
  const revision = rows.filter(r => r.status === 'revision').length
  const pending = rows.filter(r => !r.status || r.status === 'pending').length

  // Group by day, preserving order from allDayLabels
  const dayMap = new Map<string, DirectorRow[]>()
  for (const label of allDayLabels) dayMap.set(label, [])
  for (const row of rows) dayMap.get(row.dayLabel)?.push(row)
  const days = Array.from(dayMap.entries())

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-zinc-500 text-sm">CN26 · LED</span>
          <span className="text-zinc-700">/</span>
          <h1 className="font-semibold text-lg">{eventName}</h1>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Ao vivo
          </span>
        </div>
        <div className="flex items-center gap-5">
          {driveFolderId && (
            <a href={driveUrl(driveFolderId)} target="_blank" rel="noopener noreferrer"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Drive ↗</a>
          )}
          <a href="/setup/edit" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Editar</a>
          <a href="/setup" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Novo evento</a>
        </div>
      </header>

      {rows.length > 0 && (
        <div className="px-8 py-4 border-b border-zinc-800/50 flex items-center gap-8 text-sm">
          <div className="text-zinc-500"><span className="font-medium text-zinc-300">{totalTasks}</span> tarefas</div>
          <div className="flex items-center gap-1.5 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="font-medium">{approved}</span> aprovadas</div>
          <div className="flex items-center gap-1.5 text-amber-400"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /><span className="font-medium">{delivered}</span> entregues</div>
          <div className="flex items-center gap-1.5 text-orange-400"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" /><span className="font-medium">{revision}</span> em revisão</div>
          <div className="flex items-center gap-1.5 text-zinc-600"><span className="w-1.5 h-1.5 rounded-full bg-zinc-700" /><span className="font-medium">{pending}</span> pendentes</div>
        </div>
      )}

      <div className="px-8 py-6 space-y-6">
        {rows.length === 0 ? (
          <p className="text-center text-zinc-600 py-20">Nenhuma tarefa cadastrada.</p>
        ) : days.map(([dayLabel, dayRows]) => {
          const dayApproved = dayRows.filter(r => r.status === 'approved').length
          return (
            <div key={dayLabel}>
              {/* Day header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-white">{dayLabel}</h2>
                  <span className="text-xs text-zinc-500">{dayApproved}/{dayRows.length} aprovadas</span>
                </div>
              </div>

              {/* Table */}
              {dayRows.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 px-5 py-6 text-sm text-zinc-600">Nenhuma tarefa configurada para este dia.</div>
              ) : (
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-zinc-900 text-zinc-500 text-xs uppercase tracking-widest border-b border-zinc-800">
                      <th className="text-left px-5 py-3 font-medium w-36">Período</th>
                      <th className="text-left px-5 py-3 font-medium w-24">Tipo</th>
                      <th className="text-left px-5 py-3 font-medium w-36">Designer</th>
                      <th className="text-left px-5 py-3 font-medium">Tarefa</th>
                      <th className="text-left px-5 py-3 font-medium w-32">Status</th>
                      <th className="text-left px-5 py-3 font-medium w-56"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayRows.map((row, idx) => {
                      const prevRow = dayRows[idx - 1]
                      const samePeriod = prevRow?.periodLabel === row.periodLabel
                      return (
                        <tr key={row.taskId} className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-900/50 transition-colors">
                          <td className={`px-5 py-4 text-sm align-middle ${samePeriod ? 'text-zinc-800' : 'text-zinc-400 font-medium'}`}>
                            {row.periodLabel}
                          </td>
                          <td className="px-5 py-4 align-middle">
                            {row.taskType === 'image'
                              ? <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md">🖼️ Imagem</span>
                              : <span className="text-xs font-medium text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md">🎬 Vídeo</span>}
                          </td>
                          <td className="px-5 py-4 text-zinc-300 text-sm align-middle font-medium">{row.designerName}</td>
                          <td className="px-5 py-4 text-zinc-200 text-sm align-middle">{row.taskName}</td>
                          <td className="px-5 py-4 align-middle"><StatusBadge status={row.status} /></td>
                          <td className="px-5 py-4 align-middle"><RowActions row={row} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
