'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import { addTaskToPeriod, removeTaskFromPeriod, reorderSlots } from '@/lib/actions'
import type { OrganizeTask, SlotRow } from '@/types'

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

interface Props {
  allTasks: OrganizeTask[]
  slots: SlotRow[]
  periods: { id: string; label: string; dayLabel: string }[]
  designers: { id: string; name: string }[]
}

export default function OrganizeView({ allTasks, slots: initialSlots, periods }: Props) {
  const router = useRouter()
  const [slots, setSlots] = useState(initialSlots)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(
    periods.find(p => p.dayLabel !== 'Geral' && p.dayLabel !== 'Fora')?.id ?? periods[0]?.id ?? ''
  )
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState('')

  // Drag state for period panel reorder
  const draggedSlotId = useRef<string | null>(null)
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null)

  // Sync when server refreshes props
  useEffect(() => { setSlots(initialSlots) }, [initialSlots])

  useEffect(() => {
    const supabase = createBrowserClient()
    const ch = supabase.channel('organize-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'led_period_slots' }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [router])

  const sessionPeriods = periods.filter(p => p.dayLabel !== 'Geral' && p.dayLabel !== 'Fora')
  const byDay = sessionPeriods.reduce<Record<string, typeof periods>>((acc, p) => {
    if (!acc[p.dayLabel]) acc[p.dayLabel] = []
    acc[p.dayLabel].push(p)
    return acc
  }, {})

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId)

  // Tasks already in the selected period
  const periodSlots = slots
    .filter(s => s.periodId === selectedPeriodId)
    .sort((a, b) => a.orderIndex - b.orderIndex)

  const periodTasks = periodSlots
    .map(s => ({ slot: s, task: allTasks.find(t => t.taskId === s.taskId) }))
    .filter((x): x is { slot: SlotRow; task: OrganizeTask } => !!x.task)

  // Geral pool: all tasks, filtered by search
  const inPeriodSet = new Set(periodSlots.map(s => s.taskId))
  const filteredTasks = allTasks.filter(t =>
    t.taskName.toLowerCase().includes(search.toLowerCase()) ||
    t.designerName.toLowerCase().includes(search.toLowerCase())
  )

  function handleAdd(task: OrganizeTask) {
    if (inPeriodSet.has(task.taskId)) return
    const tempId = `temp-${Date.now()}`
    const newSlot: SlotRow = {
      slotId: tempId,
      periodId: selectedPeriodId,
      taskId: task.taskId,
      orderIndex: periodSlots.length,
    }
    setSlots(prev => [...prev, newSlot])
    startTransition(async () => {
      const res = await addTaskToPeriod(task.taskId, selectedPeriodId)
      if (res.slotId) {
        setSlots(prev => prev.map(s => s.slotId === tempId ? { ...s, slotId: res.slotId! } : s))
      } else {
        setSlots(prev => prev.filter(s => s.slotId !== tempId))
      }
      router.refresh()
    })
  }

  function handleRemove(slot: SlotRow) {
    setSlots(prev => prev.filter(s => s.slotId !== slot.slotId))
    startTransition(async () => {
      await removeTaskFromPeriod(slot.slotId)
      router.refresh()
    })
  }

  function handleDragStart(slotId: string) {
    draggedSlotId.current = slotId
  }

  function handleDragOver(e: React.DragEvent, targetSlotId: string) {
    e.preventDefault()
    if (draggedSlotId.current && draggedSlotId.current !== targetSlotId) {
      setDragOverSlotId(targetSlotId)
    }
  }

  function handleDrop(targetSlotId: string) {
    const fromId = draggedSlotId.current
    if (!fromId || fromId === targetSlotId) { draggedSlotId.current = null; setDragOverSlotId(null); return }

    const ids = periodSlots.map(s => s.slotId)
    const fromIdx = ids.indexOf(fromId)
    const toIdx = ids.indexOf(targetSlotId)
    if (fromIdx === -1 || toIdx === -1) { draggedSlotId.current = null; setDragOverSlotId(null); return }

    const reordered = [...ids]
    reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, fromId)

    setSlots(prev => {
      const others = prev.filter(s => s.periodId !== selectedPeriodId)
      const reorderedSlots = reordered.map((id, i) => {
        const s = prev.find(s => s.slotId === id)!
        return { ...s, orderIndex: i }
      })
      return [...others, ...reorderedSlots]
    })

    draggedSlotId.current = null
    setDragOverSlotId(null)

    startTransition(async () => {
      await reorderSlots(reordered)
      router.refresh()
    })
  }

  // Count how many periods each task is assigned to (for Geral pool badge)
  const taskPeriodCount = (taskId: string) =>
    slots.filter(s => s.taskId === taskId && periods.find(p => p.id === s.periodId && p.dayLabel !== 'Geral' && p.dayLabel !== 'Fora')).length

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/director" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Director</a>
          <span className="text-zinc-700">/</span>
          <h1 className="font-semibold text-white">Organizar por Período</h1>
        </div>
        <span className="text-xs text-zinc-600">{allTasks.length} tarefas no pool</span>
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
                  {slots.filter(s => s.periodId === p.id).length}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: pool de todas as tarefas */}
        <div className="w-80 shrink-0 border-r border-zinc-800 flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-800/60 space-y-2">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Pool — Todas as Tarefas</p>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {filteredTasks.map(task => {
              const alreadyIn = inPeriodSet.has(task.taskId)
              const s = STATUS_STYLE[task.status ?? 'pending']
              const count = taskPeriodCount(task.taskId)
              return (
                <div
                  key={task.taskId}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    alreadyIn
                      ? 'border-blue-500/20 bg-blue-500/5'
                      : 'border-zinc-700/60 bg-zinc-800/60 hover:bg-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <span className="text-sm shrink-0">{TYPE_BADGE[task.taskType] ?? '📄'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-100 truncate">{task.taskName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {task.designerName && <span className="text-[10px] text-zinc-600">{task.designerName}</span>}
                      {count > 0 && (
                        <span className="text-[10px] px-1 rounded bg-blue-500/20 text-blue-400 font-medium">
                          {count}p
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAdd(task)}
                    disabled={alreadyIn}
                    className={`shrink-0 text-xs px-2 py-0.5 rounded-lg border font-medium transition-colors ${
                      alreadyIn
                        ? 'border-blue-500/20 text-blue-500/50 cursor-default'
                        : 'border-blue-500/40 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                    }`}
                  >
                    {alreadyIn ? '✓' : '+'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: período selecionado */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800/60">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              {selectedPeriod?.dayLabel} · {selectedPeriod?.label}
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">
              {periodTasks.length} tarefa{periodTasks.length !== 1 ? 's' : ''} · arraste para reordenar
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
            {periodTasks.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-12">
                Nenhuma tarefa neste período.<br />
                <span className="text-zinc-700">Adicione tarefas do pool à esquerda.</span>
              </p>
            ) : (
              periodTasks.map(({ slot, task }) => {
                const s = STATUS_STYLE[task.status ?? 'pending']
                const isDragOver = dragOverSlotId === slot.slotId
                return (
                  <div
                    key={slot.slotId}
                    draggable
                    onDragStart={() => handleDragStart(slot.slotId)}
                    onDragOver={e => handleDragOver(e, slot.slotId)}
                    onDrop={() => handleDrop(slot.slotId)}
                    onDragEnd={() => { draggedSlotId.current = null; setDragOverSlotId(null) }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing select-none ${
                      isDragOver
                        ? 'border-blue-500/50 bg-blue-500/5 scale-[1.01]'
                        : 'border-zinc-700/40 bg-zinc-800/40 hover:bg-zinc-800/70 hover:border-zinc-600'
                    }`}
                  >
                    <span className="text-zinc-600 text-xs">⠿</span>
                    <span className="text-base shrink-0">{TYPE_BADGE[task.taskType] ?? '📄'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-100 truncate">{task.taskName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {task.designerName && <span className="text-xs text-zinc-500">{task.designerName}</span>}
                        <span className={`inline-flex items-center gap-1 text-xs ${s.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(slot)}
                      className="shrink-0 text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors border-zinc-600/40 bg-zinc-700/30 text-zinc-500 hover:text-red-400 hover:border-red-500/30"
                    >
                      ✕
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
