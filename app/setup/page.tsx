export const dynamic = 'force-dynamic'

import SetupForm from './SetupForm'

export default function SetupPage() {
  return (
    <>
      <SetupForm />
      <p className="text-center text-zinc-600 text-sm pb-10">
        Tens uma planilha?{' '}
        <a href="/setup/import" className="text-zinc-400 hover:text-white transition-colors underline underline-offset-2">
          Importar CSV
        </a>
      </p>
    </>
  )
}
