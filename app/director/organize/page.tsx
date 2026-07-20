export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getActiveEvent, getDirectorData } from '@/lib/queries'
import OrganizeView from './OrganizeView'

export default async function OrganizePage() {
  const event = await getActiveEvent()
  if (!event) redirect('/setup')

  const { rows, periods, designers } = await getDirectorData(event.id)

  return <OrganizeView rows={rows} periods={periods} designers={designers} />
}
