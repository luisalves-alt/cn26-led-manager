'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import { moveTask } from '@/lib/actions'
import type { DirectorRow } from '@/types'

const TYPE_BADGE: Record<string, string> = {
  image: '🖼️',
  video: '🎬',
}

const STATUS_STYLE: Record<string, { dot: string; label: string; cls: string }> = {
  pending:   { dot: 'bg-zinc-600',    label: 'Pendente', cls: 'text-zinc-500' },
  delivered: { dot: 'bg-amber-400',   label: 'Entregue', cls: 'text-amber-400' },
  revision:  { dot: 'bg-orange-400',  label: 'Revisão',  cls: 'text-orange-400' },
  approved:  { dot: 'bg-emerald-400', label: 'Aprovado', cls: 'text-emerald-400' },
}

function TaskRow({ row, action, onAction }: {
  row: DirectorRow
  action: 'add' | 'remove'
  onAction: () => void
}) {
  const [pending, start] = useTransition()
  const s = STATUS_STYLE[row.status ?? 'pending']

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
      action === 'add'
        ? 'border-zinc-700/60 bg-zinc-800/60 hover:bg-zinc-800 hover:border-zinc-600'
        : 'border-zinc-700/40 bg-zinc-800/40 hover:bg-zinc-800/70 hover:border-zinc-600'
    }`}>
      <span className="text-base shrink-0">{TYPE_BADGE[row.taskType] ?? '📄'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-100 truncate">{row.taskName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {row.designerName && (
            <span className="text-xs text-zinc-500">{row.designerName}</span>
          )}
          <span className={`inline-flex items-center gap-1 text-xs ${s.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        </div>
      </div>
      <button
        disabled={pending}
        onClick={() => start(async () => { await onAction(); })}
        className={`shrink-0 text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors disabled:opacity-40 ${
          action === 'add'
            ? 'border-blue-500/40 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
            : 'border-zinc-600/40 bg-zinc-700/30 text-zinc-500 hover:text-red-400 hover:border-red-500/30'
        }`}
      >
        {action === 'add' ? '+ Adicionar' : '← Remover'}
      </button>
    </div>
  )
}

interface Props {
  rows: DirectorRow[]
  periods: { id: string; label: string; dayLabel: string }[]
  designers: { id: string; name: string }[]
}

export default function OrganizeView({ rows: initialRows, periods, designers }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(
    periods.find(p => p.dayLabel !== 'Geral' && p.dayLabel !== 'Fora')?.id ?? periods[0]?.id ?? ''
  )

  useEffect(() => {
    const supabase = createBrowserClient()
    const ch = supabase.channel('organize-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'led_tasks' }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [router])

  // Find the "Geral/Todos os Períodos" period
  const geralPeriod = periods.find(p => p.dayLabel === 'Geral')

  // Derive rows from local state for instant feedback
  const geralRows = rows.filter(r => r.periodId === geralPeriod?.id)
  const periodRows = rows.filter(r => r.periodId === selectedPeriodId)

  async function handleMove(taskId: string, toPeriodId: string) {
    // Optimistic update
    setRows(prev => prev.map(r => r.taskId === taskId ? { ...r, periodId: toPeriodId } : r))
    await moveTask(taskId, toPeriodId)
    router.refresh()
  }

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId)
  const sessionPeriods = periods.filter(p => p.dayLabel !== 'Geral' && p.dayLabel !== 'Fora')

  // Group session periods by day
  const byDay = sessionPeriods.reduce<Record<string, typeof periods>>((acc, p) => {
    if (!acc[p.dayLabel]) acc[p.dayLabel] = []
    acc[p.dayLabel].push(p)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/director" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Director</a>
          <span className="text-zinc-700">/</span>
          <h1 className="font-semibold text-white">Organizar por Período</h1>
        </div>
        <span className="text-xs text-zinc-600">{geralRows.length} tarefas no Geral</span>
      </header>

      {/* Period tabs */}
      <div className="border-b border-zinc-800 px-6 py-3 flex gap-4 overflow-x-auto">
        {Object.entries(byDay).map(([dayLabel, dayPeriods]) => (
          <div key={dayLabel} className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-zinc-600 mr-1">{dayLabel}</span>
            {dayPeriods.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPeriodId(p.id)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  selectedPeriodId === p.id
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                    : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400'
                }`}
              >
                {p.label}
                <span className="ml-1.5 text-[10px] opacity-60">
                  {rows.filter(r => r.periodId === p.id).length}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 gap-0 overflow-hidden">

        {/* Left: Geral pool */}
        <div className="w-80 shrink-0 border-r border-zinc-800 flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-800/60">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Pool — Geral</p>
            <p className="text-xs text-zinc-600 mt-0.5">Tarefas sem período definido</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {geralRows.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-8">Nenhuma tarefa no Geral</p>
            ) : (
              geralRows.map(row => (
                <TaskRow
                  key={row.taskId}
                  row={row}
                  action="add"
                  onAction={() => handleMove(row.taskId, selectedPeriodId)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: selected period */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                {selectedPeriod?.dayLabel} · {selectedPeriod?.label}
              </p>
              <p className="text-xs text-zinc-600 mt-0.5">{periodRows.length} tarefa{periodRows.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
            {periodRows.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-12">
                Nenhuma tarefa neste período.<br />
                <span className="text-zinc-700">Adicione tarefas do pool à esquerda.</span>
              </p>
            ) : (
              periodRows.map(row => (
                <TaskRow
                  key={row.taskId}
                  row={row}
                  action="remove"
                  onAction={() => handleMove(row.taskId, geralPeriod!.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
