import { createServiceClient } from './supabase'
import type { Designer, SetupData, SetupDay, SetupPeriod, SetupDesignerSlot, SetupTask, DirectorRow, DesignerType } from '@/types'

export async function getActiveEvent() {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('led_events')
    .select('*')
    .eq('is_active', true)
    .single()
  return data
}

export async function getDirectorData(eventId: string): Promise<{
  eventName: string
  driveFolderId: string | null
  rows: DirectorRow[]
  allDayLabels: string[]
  periods: { id: string; label: string; dayLabel: string }[]
}> {
  const supabase = createServiceClient()

  const [{ data: event }, { data: days }] = await Promise.all([
    supabase.from('led_events').select('name, drive_folder_id').eq('id', eventId).single(),
    supabase.from('led_days').select('*').eq('event_id', eventId).order('number'),
  ])

  const rows: DirectorRow[] = []
  const periods: { id: string; label: string; dayLabel: string }[] = []

  for (const day of days ?? []) {
    const { data: dayPeriods } = await supabase
      .from('led_periods')
      .select('*')
      .eq('day_id', day.id)
      .order('order_index')

    for (const period of dayPeriods ?? []) {
      periods.push({ id: period.id, label: period.label, dayLabel: day.label })
      const { data: tasks } = await supabase
        .from('led_tasks')
        .select('*, led_designers(*), led_deliveries(*)')
        .eq('period_id', period.id)
        .order('order_index')


      for (const task of tasks ?? []) {
        const designer = task.led_designers as any
        const delivery = Array.isArray(task.led_deliveries) ? task.led_deliveries[0] : task.led_deliveries

        rows.push({
          dayNumber: day.number,
          dayLabel: day.label,
          periodId: period.id,
          periodLabel: period.label,
          designerName: designer?.name ?? '',
          taskType: (task.type ?? 'image') as DesignerType,
          taskId: task.id,
          taskName: task.name,
          deadline: task.deadline ?? null,
          deliveryId: delivery?.id ?? null,
          status: delivery?.status ?? null,
          revisionNote: delivery?.revision_note ?? null,
        })
      }
    }
  }

  const allDayLabels = (days ?? []).map((d) => d.label)
  return { eventName: event?.name ?? '', driveFolderId: (event as any)?.drive_folder_id ?? null, rows, allDayLabels, periods }
}

export async function getDesignerData(designerId: string) {
  const supabase = createServiceClient()

  const { data: designer } = await supabase
    .from('led_designers')
    .select('*, led_events(name)')
    .eq('id', designerId)
    .single()

  if (!designer) return null

  const { data: tasks } = await supabase
    .from('led_tasks')
    .select('*, led_deliveries(*), led_periods(*, led_days(*))')
    .eq('designer_id', designerId)

  const items = (tasks ?? [])
    .map((task) => {
      const period = task.led_periods as any
      const day = period?.led_days as any
      const delivery = Array.isArray(task.led_deliveries) ? task.led_deliveries[0] : task.led_deliveries
      return {
        taskId: task.id,
        taskType: (task.type ?? 'image') as DesignerType,
        driveFolderId: task.drive_folder_id ?? null,
        deadline: task.deadline ?? null,
        deliveryId: delivery?.id ?? null,
        status: (delivery?.status ?? 'pending') as string,
        revisionNote: delivery?.revision_note ?? null,
        dayNumber: day?.number ?? 0,
        dayLabel: day?.label ?? '',
        periodLabel: period?.label ?? '',
        taskName: task.name,
        taskOrder: task.order_index ?? 0,
        periodOrder: period?.order_index ?? 0,
      }
    })
    .sort((a, b) => a.dayNumber - b.dayNumber || a.periodOrder - b.periodOrder || a.taskOrder - b.taskOrder)

  return { designer, items }
}

export async function getEventForEdit(eventId: string): Promise<SetupData> {
  const supabase = createServiceClient()

  const [{ data: event }, { data: designers }, { data: days }] = await Promise.all([
    supabase.from('led_events').select('name').eq('id', eventId).single(),
    supabase.from('led_designers').select('*').eq('event_id', eventId).order('name'),
    supabase.from('led_days').select('*').eq('event_id', eventId).order('number'),
  ])

  const designerList = (designers ?? []).map((d) => ({ name: d.name }))
  const scheduleDays: SetupDay[] = []

  for (const day of days ?? []) {
    const { data: periods } = await supabase
      .from('led_periods')
      .select('*')
      .eq('day_id', day.id)
      .order('order_index')

    const setupPeriods: SetupPeriod[] = []

    for (const period of periods ?? []) {
      const { data: tasks } = await supabase
        .from('led_tasks')
        .select('*')
        .eq('period_id', period.id)
        .order('order_index')

      const slotMap = new Map<string, { designerIndex: number; type: DesignerType; tasks: SetupTask[] }>()
      for (const task of tasks ?? []) {
        const designerIndex = (designers ?? []).findIndex((d) => d.id === task.designer_id)
        if (designerIndex < 0) continue
        const key = `${task.designer_id}:${task.type}`
        if (!slotMap.has(key)) {
          slotMap.set(key, { designerIndex, type: (task.type ?? 'image') as DesignerType, tasks: [] })
        }
        slotMap.get(key)!.tasks.push({ localId: task.id, dbId: task.id, name: task.name, deadline: task.deadline ?? undefined })
      }

      const designerSlots: SetupDesignerSlot[] = Array.from(slotMap.values())
      setupPeriods.push({ localId: period.id, dbId: period.id, label: period.label, designerSlots })
    }

    scheduleDays.push({ localId: day.id, dbId: day.id, number: day.number, label: day.label, periods: setupPeriods })
  }

  return { eventName: event?.name ?? '', designers: designerList, schedule: scheduleDays }
}
