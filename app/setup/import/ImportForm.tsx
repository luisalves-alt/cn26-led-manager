'use client'

import { useState, useRef } from 'react'
import { createEvent } from '@/lib/actions'
import type { SetupData, SetupDay, SetupPeriod, SetupDesignerSlot, SetupTask, DesignerType } from '@/types'
import * as XLSX from 'xlsx'

const DAY_WORDS_NORMALIZED = ['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO', 'DOMINGO']
const DAY_WORDS_DISPLAY   = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const PERIOD_WORDS_NORM   = ['MANHA', 'TARDE', 'NOITE', 'MADRUGADA']
const PERIOD_WORDS_DISPLAY = ['Manhã', 'Tarde', 'Noite', 'Madrugada']

function norm(s: string) {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function parseProgramacao(prog: string): { day: string; period: string } {
  const n = norm(prog.trim())

  if (n.includes('TODOS')) return { day: 'Geral', period: 'Todos os Períodos' }
  if (n === 'FORA') return { day: 'Fora', period: 'Geral' }

  const di = DAY_WORDS_NORMALIZED.findIndex(d => n.startsWith(d))
  const pi = PERIOD_WORDS_NORM.findIndex(p => n.includes(p))

  if (di >= 0 && pi >= 0) {
    return { day: DAY_WORDS_DISPLAY[di], period: PERIOD_WORDS_DISPLAY[pi] }
  }
  if (di >= 0) {
    return { day: DAY_WORDS_DISPLAY[di], period: 'Geral' }
  }

  return { day: prog.trim(), period: 'Geral' }
}

function parseType(tipo: string): DesignerType {
  return norm(tipo).includes('VIDEO') ? 'video' : 'image'
}

function parseCSVLine(line: string, sep: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQ = false
  for (const c of line) {
    if (c === '"') { inQ = !inQ }
    else if (c === sep && !inQ) { result.push(cur.trim()); cur = '' }
    else { cur += c }
  }
  result.push(cur.trim())
  return result
}

let counter = 0
function uid() { return `imp-${++counter}` }

interface ParsedTask {
  type: DesignerType
  name: string
  day: string
  period: string
  designer: string
}

function parseRows(matrix: string[][]): SetupData {
  // Find header row
  const headerIdx = matrix.findIndex(row =>
    row.some(c => norm(c).includes('TIPO')) && row.some(c => norm(c).includes('ITEM'))
  )
  if (headerIdx < 0) throw new Error('Cabeçalho não encontrado. O ficheiro precisa de colunas: TIPO, ITEM, PROGRAMAÇÃO, RESPONSÁVEL.')

  const headers = matrix[headerIdx].map(h => norm(h))
  const col = (keyword: string) => headers.findIndex(h => h.includes(keyword))

  const cTipo = col('TIPO')
  const cItem = col('ITEM')
  const cProg = col('PROGRAMA')
  const cResp = col('RESPONS')

  if ([cTipo, cItem, cProg, cResp].some(c => c < 0)) {
    throw new Error('Colunas em falta. O ficheiro precisa de: TIPO, ITEM, PROGRAMAÇÃO, RESPONSÁVEL')
  }

  const tasks: ParsedTask[] = []
  const designerSet = new LinkedSet<string>()

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const cols = matrix[i]
    const item = cols[cItem]?.trim()
    const prog = cols[cProg]?.trim()
    const resp = cols[cResp]?.trim()
    const tipo = cols[cTipo]?.trim()

    if (!item || !prog || !resp) continue

    const { day, period } = parseProgramacao(prog)
    designerSet.add(resp)
    tasks.push({ type: parseType(tipo ?? ''), name: item, day, period, designer: resp })
  }

  const designers = designerSet.values().map(name => ({ name }))

  // Group: day → period → "designer:type" → tasks
  const dayOrder: string[] = []
  type SlotMap = Map<string, { type: DesignerType; tasks: SetupTask[] }>
  const structure = new Map<string, Map<string, SlotMap>>()

  for (const t of tasks) {
    if (!dayOrder.includes(t.day)) dayOrder.push(t.day)
    if (!structure.has(t.day)) structure.set(t.day, new Map())
    const pMap = structure.get(t.day)!
    if (!pMap.has(t.period)) pMap.set(t.period, new Map())
    const sMap = pMap.get(t.period)!
    const key = `${t.designer}:${t.type}`
    if (!sMap.has(key)) sMap.set(key, { type: t.type, tasks: [] })
    sMap.get(key)!.tasks.push({ localId: uid(), name: t.name })
  }

  const schedule: SetupDay[] = dayOrder.map((day, di) => {
    const pMap = structure.get(day)!
    const periods: SetupPeriod[] = Array.from(pMap.entries()).map(([periodLabel, sMap]) => {
      const designerSlots: SetupDesignerSlot[] = Array.from(sMap.entries()).map(([key, { type, tasks }]) => {
        const designerName = key.slice(0, key.lastIndexOf(':'))
        const designerIndex = designers.findIndex(d => d.name === designerName)
        return { designerIndex, type, tasks }
      })
      return { localId: uid(), label: periodLabel, designerSlots }
    })
    return { localId: uid(), number: di + 1, label: day, periods }
  })

  return { eventName: 'CN26 | Pré Convenção', designers, schedule }
}

function csvToMatrix(text: string): string[][] {
  const sep = text.includes(';') ? ';' : ','
  return text.split(/\r?\n/)
    .filter(l => l.trim())
    .map(l => parseCSVLine(l, sep))
}

function xlsToMatrix(buffer: ArrayBuffer): string[][] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  return aoa.map(row => row.map((c: any) => String(c ?? '').trim()))
}

// Ordered Set helper
class LinkedSet<T> {
  private items: T[] = []
  add(v: T) { if (!this.items.includes(v)) this.items.push(v) }
  values() { return this.items }
}

interface Summary {
  data: SetupData
  dayCount: number
  periodCount: number
  taskCount: number
  designerCount: number
}

export default function ImportForm() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [eventName, setEventName] = useState('CN26 | Pré Convenção')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)

  function handleFile(file: File) {
    setError(null)
    setSummary(null)
    const isExcel = /\.(xlsx|xls|ods)$/i.test(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const result = e.target?.result!
        const matrix = isExcel
          ? xlsToMatrix(result as ArrayBuffer)
          : csvToMatrix(result as string)
        const data = parseRows(matrix)
        const periodCount = data.schedule.reduce((acc, d) => acc + d.periods.length, 0)
        const taskCount = data.schedule.reduce((acc, d) =>
          acc + d.periods.reduce((a, p) =>
            a + p.designerSlots.reduce((b, s) => b + s.tasks.length, 0), 0), 0)
        setSummary({ data, dayCount: data.schedule.length, periodCount, taskCount, designerCount: data.designers.length })
        setEventName(data.eventName)
      } catch (err: any) {
        setError(err.message)
      }
    }
    if (isExcel) reader.readAsArrayBuffer(file)
    else reader.readAsText(file, 'UTF-8')
  }

  async function handleImport() {
    if (!summary) return
    setLoading(true)
    const data = { ...summary.data, eventName }
    await createEvent(data)
  }

  return (
    <div className="min-h-screen bg-zinc-950 py-16 px-4">
      <div className="max-w-xl mx-auto space-y-10">
        <div className="text-center">
          <p className="text-zinc-500 text-sm uppercase tracking-widest mb-3">CN26 · LED</p>
          <h1 className="text-3xl font-semibold">Importar CSV</h1>
          <p className="text-zinc-500 mt-2 text-sm">Colunas necessárias: TIPO · ITEM · PROGRAMAÇÃO · RESPONSÁVEL</p>
        </div>

        {/* Upload area */}
        {!summary && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
              dragging ? 'border-zinc-500 bg-zinc-800/40' : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50'
            }`}
          >
            <p className="text-4xl mb-4">📄</p>
            <p className="text-zinc-300 font-medium">Arrasta o CSV aqui ou clica para escolher</p>
            <p className="text-zinc-600 text-sm mt-1">.csv · .xlsx · .xls</p>
            <input ref={inputRef} type="file" accept=".csv,.txt,.xlsx,.xls,.ods" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Summary + confirm */}
        {summary && (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-4">
              <p className="text-sm font-medium text-zinc-400">Detetado no CSV</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Dias', value: summary.dayCount },
                  { label: 'Períodos', value: summary.periodCount },
                  { label: 'Designers', value: summary.designerCount },
                  { label: 'Tarefas', value: summary.taskCount },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-zinc-800/60 rounded-xl px-4 py-3">
                    <p className="text-2xl font-bold text-white">{value}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              <div className="pt-2 space-y-1">
                {summary.data.schedule.map(d => (
                  <div key={d.label} className="text-xs text-zinc-500">
                    <span className="text-zinc-300 font-medium">{d.label}</span>
                    {' — '}{d.periods.map(p => p.label).join(', ')}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-zinc-300">Nome do evento</label>
              <input value={eventName} onChange={e => setEventName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-5 py-4 text-base outline-none focus:border-zinc-500 text-white" />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => { setSummary(null); setError(null) }}
                className="px-5 py-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-medium transition-colors">
                Voltar
              </button>
              <button type="button" onClick={handleImport} disabled={loading}
                className="flex-1 bg-white text-black font-semibold py-4 rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {loading ? 'A criar evento...' : 'Importar e criar evento'}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-zinc-600 text-sm">
          <a href="/setup" className="hover:text-zinc-400 transition-colors">← Criar manualmente</a>
        </p>
      </div>
    </div>
  )
}
