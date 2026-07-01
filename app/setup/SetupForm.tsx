'use client'

import { useState } from 'react'
import { createEvent, updateEvent } from '@/lib/actions'
import type { SetupData, SetupDay, SetupPeriod, SetupDesignerSlot, SetupTask, SetupDesigner, DesignerType } from '@/types'

let localCounter = 0
function uid() { return `local-${++localCounter}` }

interface Props {
  eventId?: string
  initial?: SetupData
}

export default function SetupForm({ eventId, initial }: Props) {
  const [eventName, setEventName] = useState(initial?.eventName ?? 'CN26 | Pré Convenção')
  const [designers, setDesigners] = useState<SetupDesigner[]>(initial?.designers ?? [])
  const [designerName, setDesignerName] = useState('')
  const [schedule, setSchedule] = useState<SetupDay[]>(initial?.schedule ?? [])
  const [loading, setLoading] = useState(false)

  function addDesigner() {
    const name = designerName.trim()
    if (!name || designers.some((d) => d.name === name)) return
    setDesigners([...designers, { name }])
    setDesignerName('')
  }

  function removeDesigner(index: number) {
    setDesigners(designers.filter((_, i) => i !== index))
    setSchedule(schedule.map((day) => ({
      ...day,
      periods: day.periods.map((period) => ({
        ...period,
        designerSlots: period.designerSlots
          .filter((s) => s.designerIndex !== index)
          .map((s) => ({ ...s, designerIndex: s.designerIndex > index ? s.designerIndex - 1 : s.designerIndex })),
      })),
    })))
  }

  function addDay() {
    const number = schedule.length + 1
    setSchedule([...schedule, { localId: uid(), number, label: `Dia ${number}`, periods: [] }])
  }

  function updateDayLabel(dayIdx: number, label: string) {
    setSchedule(schedule.map((d, i) => i === dayIdx ? { ...d, label } : d))
  }

  function removeDay(dayIdx: number) {
    setSchedule(schedule.filter((_, i) => i !== dayIdx).map((d, i) => ({ ...d, number: i + 1 })))
  }

  function addPeriod(dayIdx: number) {
    setSchedule(schedule.map((d, i) => i !== dayIdx ? d : {
      ...d,
      periods: [...d.periods, { localId: uid(), label: `Período ${d.periods.length + 1}`, designerSlots: [] }],
    }))
  }

  function updatePeriodLabel(dayIdx: number, periodIdx: number, label: string) {
    setSchedule(schedule.map((d, i) => i !== dayIdx ? d : {
      ...d,
      periods: d.periods.map((p, pi) => pi !== periodIdx ? p : { ...p, label }),
    }))
  }

  function removePeriod(dayIdx: number, periodIdx: number) {
    setSchedule(schedule.map((d, i) => i !== dayIdx ? d : {
      ...d,
      periods: d.periods.filter((_, pi) => pi !== periodIdx),
    }))
  }

  function addDesignerSlot(dayIdx: number, periodIdx: number, designerIdx: number, type: DesignerType) {
    setSchedule(schedule.map((d, i) => i !== dayIdx ? d : {
      ...d,
      periods: d.periods.map((p, pi) => pi !== periodIdx ? p : {
        ...p,
        designerSlots: [...p.designerSlots, { designerIndex: designerIdx, type, tasks: [] }],
      }),
    }))
  }

  function toggleSlotType(dayIdx: number, periodIdx: number, slotIdx: number) {
    setSchedule(schedule.map((d, i) => i !== dayIdx ? d : {
      ...d,
      periods: d.periods.map((p, pi) => pi !== periodIdx ? p : {
        ...p,
        designerSlots: p.designerSlots.map((s, si) => si !== slotIdx
          ? s
          : { ...s, type: s.type === 'image' ? 'video' : 'image' }
        ),
      }),
    }))
  }

  function removeDesignerSlot(dayIdx: number, periodIdx: number, slotIdx: number) {
    setSchedule(schedule.map((d, i) => i !== dayIdx ? d : {
      ...d,
      periods: d.periods.map((p, pi) => pi !== periodIdx ? p : {
        ...p,
        designerSlots: p.designerSlots.filter((_, si) => si !== slotIdx),
      }),
    }))
  }

  function addTask(dayIdx: number, periodIdx: number, slotIdx: number) {
    setSchedule(schedule.map((d, i) => i !== dayIdx ? d : {
      ...d,
      periods: d.periods.map((p, pi) => pi !== periodIdx ? p : {
        ...p,
        designerSlots: p.designerSlots.map((s, si) => si !== slotIdx ? s : {
          ...s,
          tasks: [...s.tasks, { localId: uid(), name: `Tarefa ${s.tasks.length + 1}` }],
        }),
      }),
    }))
  }

  function updateTaskName(dayIdx: number, periodIdx: number, slotIdx: number, taskIdx: number, name: string) {
    setSchedule(schedule.map((d, i) => i !== dayIdx ? d : {
      ...d,
      periods: d.periods.map((p, pi) => pi !== periodIdx ? p : {
        ...p,
        designerSlots: p.designerSlots.map((s, si) => si !== slotIdx ? s : {
          ...s,
          tasks: s.tasks.map((t, ti) => ti !== taskIdx ? t : { ...t, name }),
        }),
      }),
    }))
  }

  function removeTask(dayIdx: number, periodIdx: number, slotIdx: number, taskIdx: number) {
    setSchedule(schedule.map((d, i) => i !== dayIdx ? d : {
      ...d,
      periods: d.periods.map((p, pi) => pi !== periodIdx ? p : {
        ...p,
        designerSlots: p.designerSlots.map((s, si) => si !== slotIdx ? s : {
          ...s,
          tasks: s.tasks.filter((_, ti) => ti !== taskIdx),
        }),
      }),
    }))
  }

  async function handleSubmit() {
    if (loading) return
    setLoading(true)
    const data: SetupData = { eventName, designers, schedule }
    if (eventId) await updateEvent(eventId, data)
    else await createEvent(data)
  }

  return (
    <div className="min-h-screen bg-zinc-950 py-16 px-4">
      <div className="max-w-2xl mx-auto space-y-12">
        <div className="text-center">
          <p className="text-zinc-500 text-sm uppercase tracking-widest mb-3">CN26 · LED</p>
          <h1 className="text-3xl font-semibold">{eventId ? 'Editar evento' : 'Novo evento'}</h1>
        </div>

        {/* Event name */}
        <div className="space-y-3">
          <label className="block text-base font-medium text-zinc-300">Nome do evento</label>
          <input
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-5 py-4 text-base outline-none focus:border-zinc-500 text-white placeholder:text-zinc-600"
            placeholder="Ex: CN26 Natal"
          />
        </div>

        {/* Designers */}
        <div className="space-y-4">
          <label className="block text-base font-medium text-zinc-300">Designers</label>
          <div className="flex gap-3">
            <input
              value={designerName}
              onChange={(e) => setDesignerName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addDesigner()}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-5 py-4 text-base outline-none focus:border-zinc-500 text-white placeholder:text-zinc-600"
              placeholder="Nome do designer"
            />
            <button type="button" onClick={addDesigner}
              className="bg-zinc-800 hover:bg-zinc-700 px-6 py-4 rounded-xl text-base font-medium transition-colors whitespace-nowrap">
              Adicionar
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {designers.map((d, i) => (
              <span key={i} className="flex items-center gap-2 text-sm px-4 py-2 rounded-full border bg-zinc-800/60 border-zinc-700 text-zinc-200">
                {d.name}
                <button type="button" onClick={() => removeDesigner(i)} className="text-zinc-500 hover:text-zinc-200 text-base leading-none">×</button>
              </span>
            ))}
          </div>
        </div>

        {/* Schedule */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <label className="text-base font-medium text-zinc-300">Cronograma</label>
            <button type="button" onClick={addDay}
              className="text-sm font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg transition-colors">
              + Dia
            </button>
          </div>

          {schedule.map((day, dayIdx) => (
            <div key={day.localId} className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 space-y-5">
              <div className="flex items-center gap-3">
                <input value={day.label} onChange={(e) => updateDayLabel(dayIdx, e.target.value)}
                  className="flex-1 bg-transparent text-lg font-semibold outline-none border-b border-transparent focus:border-zinc-600 pb-1 text-white" />
                <button type="button" onClick={() => removeDay(dayIdx)}
                  className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors">remover</button>
              </div>

              {day.periods.map((period, periodIdx) => {
                const usedImageIndices = new Set(
                  period.designerSlots.filter((s) => s.type === 'image').map((s) => s.designerIndex)
                )
                const usedVideoIndices = new Set(
                  period.designerSlots.filter((s) => s.type === 'video').map((s) => s.designerIndex)
                )
                const availableImageDesigners = designers.map((d, i) => ({ d, i })).filter(({ i }) => !usedImageIndices.has(i))
                const availableVideoDesigners = designers.map((d, i) => ({ d, i })).filter(({ i }) => !usedVideoIndices.has(i))

                const imageSlots = period.designerSlots.map((s, si) => ({ s, si })).filter(({ s }) => s.type === 'image')
                const videoSlots = period.designerSlots.map((s, si) => ({ s, si })).filter(({ s }) => s.type === 'video')

                return (
                  <div key={period.localId} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-5">
                    <div className="flex items-center gap-3">
                      <input value={period.label} onChange={(e) => updatePeriodLabel(dayIdx, periodIdx, e.target.value)}
                        className="flex-1 bg-transparent text-base font-medium outline-none border-b border-transparent focus:border-zinc-600 pb-1 text-zinc-200" />
                      <button type="button" onClick={() => removePeriod(dayIdx, periodIdx)}
                        className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors">remover</button>
                    </div>

                    {/* Imagens */}
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-blue-400 uppercase tracking-widest">🖼️ Imagens</p>
                      {imageSlots.map(({ s: slot, si: slotIdx }) => {
                        const designer = designers[slot.designerIndex]
                        return (
                          <div key={`img-${slot.designerIndex}`} className="pl-4 border-l-2 border-blue-500/30 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-medium text-blue-300">{designer?.name}</span>
                                <button type="button" onClick={() => toggleSlotType(dayIdx, periodIdx, slotIdx)}
                                  className="text-xs text-blue-500/60 hover:text-purple-400 transition-colors" title="Mudar para Vídeo">→ 🎬</button>
                              </div>
                              <button type="button" onClick={() => removeDesignerSlot(dayIdx, periodIdx, slotIdx)}
                                className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors">remover</button>
                            </div>
                            {slot.tasks.map((task, taskIdx) => (
                              <div key={task.localId} className="flex items-center gap-2 pl-2">
                                <input value={task.name}
                                  onChange={(e) => updateTaskName(dayIdx, periodIdx, slotIdx, taskIdx, e.target.value)}
                                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-zinc-600 text-zinc-300" />
                                <button type="button" onClick={() => removeTask(dayIdx, periodIdx, slotIdx, taskIdx)}
                                  className="text-zinc-600 hover:text-zinc-400 text-lg leading-none transition-colors">×</button>
                              </div>
                            ))}
                            <button type="button" onClick={() => addTask(dayIdx, periodIdx, slotIdx)}
                              className="text-sm text-zinc-500 hover:text-zinc-300 pl-2 transition-colors">+ tarefa</button>
                          </div>
                        )
                      })}
                      {availableImageDesigners.length > 0 && (
                        <div className="flex flex-wrap gap-2 pl-4">
                          {availableImageDesigners.map(({ d, i }) => (
                            <button key={i} type="button" onClick={() => addDesignerSlot(dayIdx, periodIdx, i, 'image')}
                              className="text-sm px-3 py-1.5 rounded-full border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors">
                              + {d.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Vídeos */}
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-purple-400 uppercase tracking-widest">🎬 Vídeos</p>
                      {videoSlots.map(({ s: slot, si: slotIdx }) => {
                        const designer = designers[slot.designerIndex]
                        return (
                          <div key={`vid-${slot.designerIndex}`} className="pl-4 border-l-2 border-purple-500/30 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-medium text-purple-300">{designer?.name}</span>
                                <button type="button" onClick={() => toggleSlotType(dayIdx, periodIdx, slotIdx)}
                                  className="text-xs text-purple-500/60 hover:text-blue-400 transition-colors" title="Mudar para Imagem">→ 🖼️</button>
                              </div>
                              <button type="button" onClick={() => removeDesignerSlot(dayIdx, periodIdx, slotIdx)}
                                className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors">remover</button>
                            </div>
                            {slot.tasks.map((task, taskIdx) => (
                              <div key={task.localId} className="flex items-center gap-2 pl-2">
                                <input value={task.name}
                                  onChange={(e) => updateTaskName(dayIdx, periodIdx, slotIdx, taskIdx, e.target.value)}
                                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-zinc-600 text-zinc-300" />
                                <button type="button" onClick={() => removeTask(dayIdx, periodIdx, slotIdx, taskIdx)}
                                  className="text-zinc-600 hover:text-zinc-400 text-lg leading-none transition-colors">×</button>
                              </div>
                            ))}
                            <button type="button" onClick={() => addTask(dayIdx, periodIdx, slotIdx)}
                              className="text-sm text-zinc-500 hover:text-zinc-300 pl-2 transition-colors">+ tarefa</button>
                          </div>
                        )
                      })}
                      {availableVideoDesigners.length > 0 && (
                        <div className="flex flex-wrap gap-2 pl-4">
                          {availableVideoDesigners.map(({ d, i }) => (
                            <button key={i} type="button" onClick={() => addDesignerSlot(dayIdx, periodIdx, i, 'video')}
                              className="text-sm px-3 py-1.5 rounded-full border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 transition-colors">
                              + {d.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              <button type="button" onClick={() => addPeriod(dayIdx)}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">+ período</button>
            </div>
          ))}
        </div>

        <button type="button" onClick={handleSubmit} disabled={loading}
          className="w-full bg-white text-black font-semibold py-4 text-base rounded-2xl hover:bg-zinc-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {loading && (
            <svg className="animate-spin h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {loading
            ? (eventId ? 'A guardar...' : 'A criar evento...')
            : (eventId ? 'Salvar alterações' : 'Criar evento')}
        </button>
      </div>
    </div>
  )
}
