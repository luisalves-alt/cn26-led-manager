export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getActiveEvent } from '@/lib/queries'
import { createServiceClient } from '@/lib/supabase'
import type { Designer } from '@/types'

export default async function DesignerSelectPage() {
  const event = await getActiveEvent()
  if (!event) redirect('/setup')

  const supabase = createServiceClient()
  const { data: designers } = await supabase
    .from('led_designers')
    .select('*')
    .eq('event_id', event.id)
    .order('name')

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <p className="text-zinc-500 text-sm uppercase tracking-widest mb-2">CN26</p>
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <p className="text-zinc-500 mt-2">Quem é você?</p>
        </div>

        <div className="space-y-3">
          {(designers ?? []).map((designer: Designer) => (
            <a
              key={designer.id}
              href={`/designer/${designer.id}`}
              className="flex items-center justify-between w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 rounded-2xl px-6 py-5 transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-lg">{designer.name}</span>
              </div>
              <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors">→</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
