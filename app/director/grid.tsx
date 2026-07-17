'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import { markApproved, requestRevision, moveTask, toggleStorage, updateTask } from '@/lib/actions'
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

function EditRow({ row, designers, onClose }: {
  row: DirectorRow
  designers: { id: string; name: string }[]
  onClose: () => void
}) {
  const [name, setName] = useState(row.taskName)
  const [type, setType] = useState<'image' | 'video'>(row.taskType)
  const [designerId, setDesignerId] = useState(row.designerId)
  const [deadline, setDeadline] = useState(row.deadline ?? '')
  const [notes, setNotes] = useState(row.notes ?? '')
  const [pending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      await updateTask(row.taskId, { name, type, designerId, deadline: deadline || null, notes: notes || null })
      onClose()
    })
  }

  return (
    <tr className="bg-zinc-900/80 border-b border-zinc-700">
      <td colSpan={8} className="px-5 py-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Nome</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-56 text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 outline-none focus:border-zinc-500 text-zinc-200"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Tipo</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as 'image' | 'video')}
              className="text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 outline-none focus:border-zinc-500 text-zinc-200"
            >
              <option value="image">🖼️ Imagem</option>
              <option value="video">🎬 Vídeo</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Designer</label>
            <select
              value={designerId}
              onChange={e => setDesignerId(e.target.value)}
              className="text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 outline-none focus:border-zinc-500 text-zinc-200"
            >
              {designers.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Prazo</label>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 outline-none focus:border-zinc-500 text-zinc-200"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-xs text-zinc-500">Observação</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Observação..."
              className="w-full text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 outline-none focus:border-zinc-500 text-zinc-200 placeholder:text-zinc-600"
            />
          </div>
          <div className="flex gap-2 pb-0.5">
            <button
              onClick={handleSave}
              disabled={!name.trim() || pending}
              className="text-sm px-4 py-1.5 bg-white text-black rounded-lg font-medium disabled:opacity-40 hover:bg-zinc-100 transition-colors"
            >
              {pending ? '...' : 'Salvar'}
            </button>
            <button
              onClick={onClose}
              className="text-sm px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

function StorageToggle({ row }: { row: DirectorRow }) {
  const [on, setOn] = useState(row.onStorage)
  const [pending, startTransition] = useTransition()

  if (!row.deliveryId) return null

  return (
    <button
      type="button"
      disabled={pending}
      title={on ? 'No HD/SSD — clique para remover' : 'Clique para marcar como no HD/SSD'}
      onClick={() => {
        setOn(v => !v)
        startTransition(async () => {
          await toggleStorage(row.deliveryId!, on)
        })
      }}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
        on
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
          : 'bg-zinc-800/60 border-zinc-700 text-zinc-600 hover:text-zinc-400 hover:border-zinc-600'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
      HD
    </button>
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

function MoveTaskButton({ taskId, currentPeriodId, periods }: {
  taskId: string
  currentPeriodId?: string
  periods: { id: string; label: string; dayLabel: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const others = periods.filter(p => p.id !== currentPeriodId)
  if (others.length === 0) return null

  if (pending) {
    return (
      <svg className="animate-spin h-3.5 w-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    )
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="text-xs px-2 py-1 text-zinc-600 hover:text-zinc-400 transition-colors" title="Mover tarefa">
        ⇄
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-30 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl py-1 min-w-[180px]">
          <p className="text-xs text-zinc-500 px-3 py-1.5 border-b border-zinc-800">Mover para…</p>
          {others.map(p => (
            <button key={p.id} type="button"
              onClick={() => startTransition(async () => {
                await moveTask(taskId, p.id)
                setOpen(false)
              })}
              className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors">
              <span className="text-zinc-500">{p.dayLabel} · </span>{p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  eventName: string
  driveFolderId: string | null
  rows: DirectorRow[]
  allDayLabels: string[]
  periods: { id: string; label: string; dayLabel: string }[]
  designers: { id: string; name: string }[]
}

const STATUS_LABELS: Record<string, string> = {
  pending:   'Pendente',
  delivered: 'Entregue',
  revision:  'Revisão',
  approved:  'Aprovado',
}

export default function DirectorGrid({ eventName, driveFolderId, rows, allDayLabels, periods, designers }: Props) {
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

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

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

  const printDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <>
    {/* ── Print-only view ── */}
    <style>{`
      @media print {
        body > * { display: none !important; }
        #pdf-export { display: block !important; }
        @page { margin: 18mm 14mm; size: A4 landscape; }
      }
    `}</style>

    <div id="pdf-export" style={{ display: 'none' }} className="font-sans text-black bg-white p-0">
      <div className="mb-4 flex items-end justify-between border-b border-gray-300 pb-3">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">CN26 · LED Manager</p>
          <h1 className="text-xl font-bold text-black">{eventName}</h1>
        </div>
        <p className="text-xs text-gray-400">{printDate}</p>
      </div>

      {days.map(([dayLabel, dayRows]) => (
        <div key={dayLabel} className="mb-6">
          <h2 className="text-sm font-bold text-black mb-1.5 uppercase tracking-wide">{dayLabel}</h2>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Período</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Tipo</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Designer</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Tarefa</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Prazo</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Observação</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Status</th>
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold">HD/SSD</th>
              </tr>
            </thead>
            <tbody>
              {dayRows.map((row, idx) => {
                const prevRow = dayRows[idx - 1]
                const samePeriod = prevRow?.periodLabel === row.periodLabel
                return (
                  <tr key={row.taskId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-200 px-3 py-2 text-gray-500">{samePeriod ? '' : row.periodLabel}</td>
                    <td className="border border-gray-200 px-3 py-2">{row.taskType === 'image' ? 'Imagem' : 'Vídeo'}</td>
                    <td className="border border-gray-200 px-3 py-2 font-medium">{row.designerName}</td>
                    <td className="border border-gray-200 px-3 py-2 font-medium">{row.taskName}</td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-500">
                      {row.deadline ? new Date(row.deadline + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 text-gray-400 italic">{row.notes ?? '—'}</td>
                    <td className="border border-gray-200 px-3 py-2">{STATUS_LABELS[row.status ?? 'pending']}</td>
                    <td className="border border-gray-200 px-3 py-2 text-center">{row.onStorage ? '✓' : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      <div className="mt-6 pt-3 border-t border-gray-200 flex gap-8 text-xs text-gray-400">
        <span>{rows.length} tarefas</span>
        <span>{rows.filter(r => r.status === 'approved').length} aprovadas</span>
        <span>{rows.filter(r => r.status === 'delivered').length} entregues</span>
        <span>{rows.filter(r => r.status === 'revision').length} em revisão</span>
        <span>{rows.filter(r => !r.status || r.status === 'pending').length} pendentes</span>
      </div>
    </div>

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
          <button
            onClick={() => window.print()}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Exportar PDF ↓
          </button>
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
                      <th className="text-left px-5 py-3 font-medium w-20">HD/SSD</th>
                      <th className="text-left px-5 py-3 font-medium w-56"></th>
                      <th className="px-3 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayRows.map((row, idx) => {
                      const prevRow = dayRows[idx - 1]
                      const samePeriod = prevRow?.periodLabel === row.periodLabel
                      const isEditing = editingTaskId === row.taskId
                      return (
                        <React.Fragment key={row.taskId}>
                          <tr className={`border-b border-zinc-800/40 last:border-0 transition-colors ${isEditing ? 'bg-zinc-900/80' : 'hover:bg-zinc-900/50'}`}>
                            <td className={`px-5 py-4 text-sm align-middle ${samePeriod ? 'text-zinc-800' : 'text-zinc-400 font-medium'}`}>
                              {row.periodLabel}
                            </td>
                            <td className="px-5 py-4 align-middle">
                              {row.taskType === 'image'
                                ? <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md">🖼️ Imagem</span>
                                : <span className="text-xs font-medium text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md">🎬 Vídeo</span>}
                            </td>
                            <td className="px-5 py-4 text-zinc-300 text-sm align-middle font-medium">{row.designerName}</td>
                            <td className="px-5 py-4 text-zinc-200 text-sm align-middle">
                              <span>{row.taskName}</span>
                              {row.deadline && (
                                <span className="ml-2 text-xs text-zinc-500">
                                  {new Date(row.deadline + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                </span>
                              )}
                              {row.notes && (
                                <p className="text-xs text-zinc-600 italic mt-0.5">{row.notes}</p>
                              )}
                            </td>
                            <td className="px-5 py-4 align-middle"><StatusBadge status={row.status} /></td>
                            <td className="px-5 py-4 align-middle"><StorageToggle row={row} /></td>
                            <td className="px-5 py-4 align-middle">
                              <div className="flex items-center gap-3">
                                <RowActions row={row} />
                                {row.driveFolderId && (
                                  <a href={driveUrl(row.driveFolderId)} target="_blank" rel="noopener noreferrer"
                                    className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 rounded-lg font-medium transition-colors whitespace-nowrap">
                                    Pasta ↗
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-4 align-middle">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingTaskId(isEditing ? null : row.taskId)}
                                  className={`text-xs px-2 py-1 rounded-lg transition-colors ${isEditing ? 'text-zinc-300 bg-zinc-700' : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800'}`}
                                  title="Editar tarefa"
                                >
                                  ✏️
                                </button>
                                <MoveTaskButton taskId={row.taskId} currentPeriodId={row.periodId} periods={periods} />
                              </div>
                            </td>
                          </tr>
                          {isEditing && (
                            <EditRow row={row} designers={designers} onClose={() => setEditingTaskId(null)} />
                          )}
                        </React.Fragment>
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
    </> // closes print fragment
  )
}
