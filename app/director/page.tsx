export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getActiveEvent, getDirectorData } from '@/lib/queries'
import DirectorGrid from './grid'

export default async function DirectorPage() {
  const event = await getActiveEvent()
  if (!event) redirect('/setup')

  const { eventName, driveFolderId, rows } = await getDirectorData(event.id)

  return <DirectorGrid eventName={eventName} driveFolderId={driveFolderId} rows={rows} />
}
