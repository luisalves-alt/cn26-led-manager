export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getActiveEvent, getOrganizeData } from '@/lib/queries'
import OrganizeView from './OrganizeView'

export default async function OrganizePage() {
  const event = await getActiveEvent()
  if (!event) redirect('/setup')

  const { allTasks, slots, periods, designers } = await getOrganizeData(event.id)

  return <OrganizeView allTasks={allTasks} slots={slots} periods={periods} designers={designers} />
}
