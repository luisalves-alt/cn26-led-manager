export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getDesignerData } from '@/lib/queries'
import { markDelivered } from '@/lib/actions'
import { driveUrl } from '@/lib/drive'

export default async function DesignerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getDesignerData(id)
  if (!data) redirect('/designer')

  const { designer, items } = data
  const eventName = (designer.led_events as any)?.name ?? ''

  // Group by day > period > type
  type TypeGroup = { type: 'image' | 'video'; driveFolderId: string | null; tasks: typeof items }
  type PeriodGroup = { periodLabel: string; typeGroups: TypeGroup[] }
  type DayGroup = { dayLabel: string; periods: PeriodGroup[] }

  const dayMap = new Map<string, DayGroup>()
  for (const item of items) {
    if (!dayMap.has(item.dayLabel)) dayMap.set(item.dayLabel, { dayLabel: item.dayLabel, periods: [] })
    const day = dayMap.get(item.dayLabel)!

    let period = day.periods.find((p) => p.periodLabel === item.periodLabel)
    if (!period) { period = { periodLabel: item.periodLabel, typeGroups: [] }; day.periods.push(period) }

    let tg = period.typeGroups.find((g) => g.type === item.taskType)
    if (!tg) { tg = { type: item.taskType, driveFolderId: item.driveFolderId, tasks: [] }; period.typeGroups.push(tg) }
    tg.tasks.push(item)
  }

  const days = Array.from(dayMap.values())

  return (
    <div className="min-h-screen bg-zinc-950 py-12 px-4">
      <div className="max-w-lg mx-auto space-y-8">
        <div className="text-center">
          <p className="text-zinc-500 text-sm uppercase tracking-widest mb-1">CN26 · LED</p>
          <h1 className="text-xl font-semibold">{eventName}</h1>
          <p className="font-medium text-zinc-300 mt-2">{designer.name}</p>
        </div>

        {days.map((day) => (
          <div key={day.dayLabel} className="space-y-4">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{day.dayLabel}</h2>
            {day.periods.map((period) => (
              <div key={period.periodLabel} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-2.5 border-b border-zinc-800">
                  <span className="text-sm font-medium text-zinc-300">{period.periodLabel}</span>
                </div>
                {period.typeGroups.map((tg) => (
                  <div key={tg.type}>
                    <div className={`px-5 py-2 ${tg.type === 'image' ? 'bg-blue-500/5' : 'bg-purple-500/5'}`}>
                      <span className={`text-xs font-medium ${tg.type === 'image' ? 'text-blue-400' : 'text-purple-400'}`}>
                        {tg.type === 'image' ? '🖼️ Imagens' : '🎬 Vídeos'}
                      </span>
                    </div>
                    <div className="divide-y divide-zinc-800/50">
                      {tg.tasks.map((item) => (
                        <div key={item.taskId} className="px-5 py-4 flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-zinc-200">{item.taskName}</p>
                              {item.driveFolderId && (
                                <a href={driveUrl(item.driveFolderId)} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                                  Pasta ↗
                                </a>
                              )}
                            </div>
                            {item.revisionNote && item.status === 'revision' && (
                              <p className="text-xs text-orange-300/70 italic mt-1">{item.revisionNote}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={item.status} />
                            {(item.status === 'pending' || item.status === 'revision') && (
                              <form action={markDelivered.bind(null, item.taskId)}>
                                <button type="submit"
                                  className="text-xs px-3 py-1.5 rounded-xl bg-white text-black font-medium hover:bg-zinc-200 transition-colors whitespace-nowrap">
                                  Entregar
                                </button>
                              </form>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}

        {items.length === 0 && (
          <p className="text-center text-zinc-600 py-10">Nenhuma tarefa atribuída.</p>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:   { label: 'Pendente',  cls: 'bg-zinc-800 text-zinc-500' },
    delivered: { label: 'Entregue',  cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
    revision:  { label: 'Revisão',   cls: 'bg-orange-500/15 text-orange-400 border border-orange-500/30' },
    approved:  { label: 'Aprovado',  cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  }
  const s = map[status] ?? map.pending
  return <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${s.cls}`}>{s.label}</span>
}
