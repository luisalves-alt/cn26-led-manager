export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getActiveEvent } from '@/lib/queries'

export default async function Home() {
  const event = await getActiveEvent()
  if (event) redirect('/director')
  redirect('/setup')
}
