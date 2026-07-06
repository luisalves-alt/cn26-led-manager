'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceClient } from './supabase'
import { createDriveFolder, renameDriveFolder, deleteDriveFolder, moveDriveFolder, getDriveFileParent, shareWithAnyone, driveEnabled } from './drive'
import type { SetupData, DesignerType } from '@/types'

export async function createEvent(data: SetupData) {
  const supabase = createServiceClient()
  const useDrive = driveEnabled()

  await supabase.from('led_events').update({ is_active: false }).eq('is_active', true)

  const rootFolderId = useDrive ? process.env.DRIVE_LED_ROOT_FOLDER_ID : undefined

  const { data: event, error: eventError } = await supabase
    .from('led_events')
    .insert({ name: data.eventName, drive_folder_id: rootFolderId ?? null })
    .select()
    .single()
  if (eventError) throw new Error(eventError.message)

  const { data: designers, error: designersError } = await supabase
    .from('led_designers')
    .insert(data.designers.map((d) => ({ event_id: event.id, name: d.name })))
    .select()
  if (designersError) throw new Error(designersError.message)

  for (const day of data.schedule) {
    const dayFolderId = useDrive && rootFolderId
      ? await createDriveFolder(day.label, rootFolderId)
      : undefined

    const { data: dayRow, error: dayErr } = await supabase
      .from('led_days')
      .insert({ event_id: event.id, number: day.number, label: day.label, drive_folder_id: dayFolderId ?? null })
      .select()
      .single()
    if (dayErr) throw new Error(dayErr.message)

    for (let pi = 0; pi < day.periods.length; pi++) {
      const period = day.periods[pi]

      const periodFolderId = useDrive && dayFolderId ? await createDriveFolder(period.label, dayFolderId) : undefined
      const periodImageFolderId = useDrive && periodFolderId ? await createDriveFolder('Imagens', periodFolderId) : undefined
      const periodVideoFolderId = useDrive && periodFolderId ? await createDriveFolder('Vídeos', periodFolderId) : undefined

      const { data: periodRow, error: periodErr } = await supabase
        .from('led_periods')
        .insert({
          day_id: dayRow.id,
          label: period.label,
          order_index: pi,
          drive_folder_id: periodFolderId ?? null,
          drive_image_folder_id: periodImageFolderId ?? null,
          drive_video_folder_id: periodVideoFolderId ?? null,
        })
        .select()
        .single()
      if (periodErr) throw new Error(periodErr.message)

      for (const slot of period.designerSlots) {
        const designer = designers![slot.designerIndex]
        if (!designer) continue

        const parentFolderId = slot.type === 'image' ? periodImageFolderId : periodVideoFolderId
        let designerFolderId: string | undefined
        if (useDrive && parentFolderId) {
          designerFolderId = await createDriveFolder(designer.name, parentFolderId)
          await shareWithAnyone(designerFolderId)
        }

        for (let ti = 0; ti < slot.tasks.length; ti++) {
          const task = slot.tasks[ti]
          let taskFolderId: string | undefined
          if (useDrive && designerFolderId) {
            taskFolderId = await createDriveFolder(task.name, designerFolderId)
            await shareWithAnyone(taskFolderId)
          }
          const { data: taskRow, error: taskErr } = await supabase
            .from('led_tasks')
            .insert({
              period_id: periodRow.id,
              designer_id: designer.id,
              type: slot.type,
              name: task.name,
              order_index: ti,
              drive_folder_id: taskFolderId ?? null,
              deadline: task.deadline ?? null,
              notes: task.notes ?? null,
            })
            .select()
            .single()
          if (taskErr) throw new Error(taskErr.message)

          await supabase.from('led_deliveries').insert({ task_id: taskRow.id })
        }
      }
    }
  }

  redirect('/director')
}

export async function updateEvent(eventId: string, data: SetupData) {
  const supabase = createServiceClient()
  const useDrive = driveEnabled()

  await supabase.from('led_events').update({ name: data.eventName }).eq('id', eventId)

  const { data: existingDesigners } = await supabase.from('led_designers').select('*').eq('event_id', eventId)
  const existingNames = (existingDesigners ?? []).map((d) => d.name)
  const newDesigners = data.designers.filter((d) => !existingNames.includes(d.name))

  let allDesigners = existingDesigners ?? []
  if (newDesigners.length > 0) {
    const { data: created } = await supabase
      .from('led_designers')
      .insert(newDesigners.map((d) => ({ event_id: eventId, name: d.name })))
      .select()
    allDesigners = [...allDesigners, ...(created ?? [])]
  }

  const designersInOrder = data.designers
    .map((d) => allDesigners.find((db) => db.name === d.name))
    .filter(Boolean) as typeof allDesigners

  const { data: eventRow } = await supabase.from('led_events').select('drive_folder_id').eq('id', eventId).single()
  const rootFolderId = eventRow?.drive_folder_id as string | undefined

  // Delete removed days
  const { data: dbDays } = await supabase.from('led_days').select('id, label, drive_folder_id').eq('event_id', eventId)
  const submittedDayIds = new Set(data.schedule.map((d) => d.dbId).filter(Boolean))
  for (const dbDay of dbDays ?? []) {
    if (!submittedDayIds.has(dbDay.id)) {
      if (useDrive && dbDay.drive_folder_id) await deleteDriveFolder(dbDay.drive_folder_id)
      await supabase.from('led_days').delete().eq('id', dbDay.id)
    }
  }

  for (const day of data.schedule) {
    let dayId = day.dbId
    let dayFolderId: string | undefined

    if (dayId) {
      const { data: r } = await supabase.from('led_days').select('label, drive_folder_id').eq('id', dayId).single()
      dayFolderId = r?.drive_folder_id ?? undefined
      if (useDrive && dayFolderId && r?.label !== day.label) await renameDriveFolder(dayFolderId, day.label)
      await supabase.from('led_days').update({ label: day.label, number: day.number }).eq('id', dayId)
    } else {
      dayFolderId = useDrive && rootFolderId ? await createDriveFolder(day.label, rootFolderId) : undefined
      const { data: newDay } = await supabase
        .from('led_days')
        .insert({ event_id: eventId, number: day.number, label: day.label, drive_folder_id: dayFolderId ?? null })
        .select()
        .single()
      dayId = newDay?.id
    }

    // Delete removed periods
    const { data: dbPeriods } = await supabase.from('led_periods').select('id, label, drive_folder_id').eq('day_id', dayId)
    const submittedPeriodIds = new Set(day.periods.map((p) => p.dbId).filter(Boolean))
    for (const dbPeriod of dbPeriods ?? []) {
      if (!submittedPeriodIds.has(dbPeriod.id)) {
        if (useDrive && dbPeriod.drive_folder_id) await deleteDriveFolder(dbPeriod.drive_folder_id)
        await supabase.from('led_periods').delete().eq('id', dbPeriod.id)
      }
    }

    for (let pi = 0; pi < day.periods.length; pi++) {
      const period = day.periods[pi]
      let periodId = period.dbId
      let periodImageFolderId: string | undefined
      let periodVideoFolderId: string | undefined

      if (periodId) {
        const { data: r } = await supabase.from('led_periods').select('label, drive_folder_id, drive_image_folder_id, drive_video_folder_id').eq('id', periodId).single()
        periodImageFolderId = r?.drive_image_folder_id ?? undefined
        periodVideoFolderId = r?.drive_video_folder_id ?? undefined
        if (useDrive && r?.drive_folder_id && r?.label !== period.label) await renameDriveFolder(r.drive_folder_id, period.label)
        await supabase.from('led_periods').update({ label: period.label }).eq('id', periodId)
      } else {
        const periodFolderId = useDrive && dayFolderId ? await createDriveFolder(period.label, dayFolderId) : undefined
        periodImageFolderId = useDrive && periodFolderId ? await createDriveFolder('Imagens', periodFolderId) : undefined
        periodVideoFolderId = useDrive && periodFolderId ? await createDriveFolder('Vídeos', periodFolderId) : undefined
        const { data: newPeriod } = await supabase
          .from('led_periods')
          .insert({
            day_id: dayId,
            label: period.label,
            order_index: pi,
            drive_folder_id: periodFolderId ?? null,
            drive_image_folder_id: periodImageFolderId ?? null,
            drive_video_folder_id: periodVideoFolderId ?? null,
          })
          .select()
          .single()
        periodId = newPeriod?.id
      }

      const { data: dbTasks } = await supabase
        .from('led_tasks')
        .select('id, designer_id, type, drive_folder_id')
        .eq('period_id', periodId)

      // Build map of existing designer+type groups
      const dbKeyMap = new Map<string, { folderId: string | null; taskIds: string[] }>()
      for (const dbTask of dbTasks ?? []) {
        const key = `${dbTask.designer_id}:${dbTask.type}`
        if (!dbKeyMap.has(key)) dbKeyMap.set(key, { folderId: dbTask.drive_folder_id, taskIds: [] })
        dbKeyMap.get(key)!.taskIds.push(dbTask.id)
      }

      // Collect submitted designer+type keys
      const submittedKeys = new Set(
        period.designerSlots
          .map((s) => { const d = designersInOrder[s.designerIndex]; return d ? `${d.id}:${s.type}` : null })
          .filter(Boolean) as string[]
      )

      // Delete Drive folders and tasks for removed designer+type combos
      for (const [key, { folderId, taskIds }] of dbKeyMap) {
        if (!submittedKeys.has(key)) {
          if (useDrive && folderId) await deleteDriveFolder(folderId)
          for (const taskId of taskIds) {
            await supabase.from('led_tasks').delete().eq('id', taskId)
          }
        }
      }

      for (const slot of period.designerSlots) {
        const designer = designersInOrder[slot.designerIndex]
        if (!designer) continue

        const key = `${designer.id}:${slot.type}`
        const existingGroup = dbKeyMap.get(key)
        const existingDesignerTasks = (dbTasks ?? []).filter(
          (t) => t.designer_id === designer.id && t.type === slot.type
        )

        const parentFolderId = slot.type === 'image' ? periodImageFolderId : periodVideoFolderId
        let designerFolderId = existingGroup?.folderId ?? undefined

        if (!existingGroup && useDrive && parentFolderId) {
          designerFolderId = await createDriveFolder(designer.name, parentFolderId)
          await shareWithAnyone(designerFolderId)
        }

        const submittedTaskIds = new Set(slot.tasks.map((t) => t.dbId).filter(Boolean))
        const existingTaskIds = new Set(existingDesignerTasks.map((t) => t.id))

        // Delete removed tasks
        for (const dbTask of existingDesignerTasks) {
          if (!submittedTaskIds.has(dbTask.id)) {
            await supabase.from('led_tasks').delete().eq('id', dbTask.id)
          }
        }

        // Add or update tasks
        for (let ti = 0; ti < slot.tasks.length; ti++) {
          const task = slot.tasks[ti]
          if (task.dbId && existingTaskIds.has(task.dbId)) {
            await supabase.from('led_tasks').update({ name: task.name, order_index: ti, deadline: task.deadline ?? null, notes: task.notes ?? null }).eq('id', task.dbId)
          } else {
            let taskFolderId: string | undefined
            if (useDrive && designerFolderId) {
              taskFolderId = await createDriveFolder(task.name, designerFolderId)
              await shareWithAnyone(taskFolderId)
            }
            const { data: newTask } = await supabase
              .from('led_tasks')
              .insert({
                period_id: periodId,
                designer_id: designer.id,
                type: slot.type,
                name: task.name,
                order_index: ti,
                drive_folder_id: taskFolderId ?? null,
                deadline: task.deadline ?? null,
                notes: task.notes ?? null,
              })
              .select()
              .single()
            if (newTask) await supabase.from('led_deliveries').insert({ task_id: newTask.id })
          }
        }
      }
    }
  }

  redirect('/director')
}

export async function markDelivered(taskId: string) {
  const supabase = createServiceClient()
  await supabase
    .from('led_deliveries')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('task_id', taskId)
  revalidatePath('/designer')
  revalidatePath('/director')
}

export async function markApproved(deliveryId: string) {
  const supabase = createServiceClient()
  await supabase
    .from('led_deliveries')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', deliveryId)
  revalidatePath('/director')
}

export async function cancelDelivery(taskId: string) {
  const supabase = createServiceClient()
  await supabase
    .from('led_deliveries')
    .update({ status: 'pending', delivered_at: null })
    .eq('task_id', taskId)
  revalidatePath('/designer')
  revalidatePath('/director')
}

export async function requestRevision(deliveryId: string, note: string) {
  const supabase = createServiceClient()
  await supabase
    .from('led_deliveries')
    .update({ status: 'revision', revision_note: note })
    .eq('id', deliveryId)
  revalidatePath('/director')
  revalidatePath('/designer')
}

export async function moveTask(taskId: string, newPeriodId: string) {
  const supabase = createServiceClient()
  const useDrive = driveEnabled()

  const { data: task } = await supabase
    .from('led_tasks')
    .select('*, led_designers(name)')
    .eq('id', taskId)
    .single()
  if (!task) return

  const designer = task.led_designers as any

  const { data: newPeriod } = await supabase
    .from('led_periods')
    .select('drive_image_folder_id, drive_video_folder_id')
    .eq('id', newPeriodId)
    .single()

  if (useDrive && task.drive_folder_id && newPeriod) {
    const oldParentId = await getDriveFileParent(task.drive_folder_id)
    const newPeriodTypeFolderId = task.type === 'image'
      ? newPeriod.drive_image_folder_id
      : newPeriod.drive_video_folder_id

    if (newPeriodTypeFolderId && oldParentId) {
      const designerFolderId = await createDriveFolder(designer.name, newPeriodTypeFolderId)
      await shareWithAnyone(designerFolderId)
      await moveDriveFolder(task.drive_folder_id, designerFolderId, oldParentId)
    }
  }

  await supabase.from('led_tasks').update({ period_id: newPeriodId }).eq('id', taskId)
  revalidatePath('/director')
}
