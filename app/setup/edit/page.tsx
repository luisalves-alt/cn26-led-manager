export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getActiveEvent, getEventForEdit } from '@/lib/queries'
import SetupForm from '../SetupForm'

export default async function EditPage() {
  const event = await getActiveEvent()
  if (!event) redirect('/setup')

  const initial = await getEventForEdit(event.id)

  return <SetupForm eventId={event.id} initial={initial} />
}
