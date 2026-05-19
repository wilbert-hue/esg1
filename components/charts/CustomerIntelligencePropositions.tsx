'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Table2 } from 'lucide-react'
import {
  type CmiCustomerIntelligencePayload,
  type CmiProposition,
  normCell,
  parseGroupedHeader,
  padRow,
  sanitizeMislabeledGroupHeaders,
  trimTrailingEmptyColumns,
} from '@/lib/cmi-propositions'
import { cn } from '@/lib/utils'

function PropositionTable({ proposition }: { proposition: CmiProposition }) {
  const h1 = proposition.headerRow1
  const h2 = proposition.headerRow2
  const colCount = Math.max(h1.length, h2.length, ...proposition.dataRows.map((r) => r.length))
  const level1 = parseGroupedHeader(h1.map((c) => normCell(c)))
  const headers2 = padRow(h2, colCount)

  return (
    <div className="overflow-x-auto rounded-md border border-[#1a5c45] shadow-sm">
      <table className="w-full min-w-[720px] border-collapse text-left text-xs text-black">
        <thead>
          <tr>
            {level1.map((cell, idx) => (
              <th
                key={`r1-${idx}`}
                colSpan={cell.colspan}
                className={cn(
                  'border border-[#2d7a5c]/80 px-2 py-2 text-center text-[11px] font-semibold text-white',
                  'bg-gradient-to-b from-[#2f8f6a] to-[#267d59]'
                )}
              >
                {cell.label}
              </th>
            ))}
          </tr>
          <tr>
            {headers2.map((h, c) => (
              <th
                key={`r2-${c}`}
                className={cn(
                  'border border-[#8fcbb8] px-2 py-2 align-top font-medium text-[11px] leading-snug',
                  'bg-[#d4efe6] text-black',
                  c === 0 && 'w-12 text-center bg-[#bfe5d6]'
                )}
              >
                {h || (c === 0 ? '—' : '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {proposition.dataRows.map((raw, ri) => {
            const row = padRow(raw, colCount)
            return (
              <tr
                key={ri}
                className={ri % 2 === 0 ? 'bg-white' : 'bg-[#f4fbf8]'}
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      'border border-[#c5e0d6] px-2 py-1.5 align-top text-[11px] leading-snug',
                      ci === 0 && 'bg-[#e8f5f0] text-center font-medium tabular-nums'
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function CustomerIntelligencePropositions({ title }: { title?: string }) {
  const [payload, setPayload] = useState<CmiCustomerIntelligencePayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/data/cmi-customer-intelligence.json')
        if (!res.ok) throw new Error(`Failed to load (${res.status})`)
        const json = (await res.json()) as CmiCustomerIntelligencePayload
        if (!cancelled) setPayload(json)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Could not load customer intelligence tables: {error}
      </div>
    )
  }

  if (!payload) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm text-gray-600">
        Loading customer intelligence framework…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-black">
          {title || 'Customer Intelligence'}
        </h2>
        <p className="mt-1 text-xs text-gray-600">
          Tables match the CMI sample workbook structure (two header levels, column grouping). Source:{' '}
          <span className="font-medium text-gray-800">{payload.source}</span>
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {payload.propositions.map((p, index) => {
          let table = trimTrailingEmptyColumns(p)
          table = sanitizeMislabeledGroupHeaders(table)
          // No column stripping needed for ESG propositions
          return (
          <details
            key={p.id}
            open={index === 0}
            className="group overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 bg-gradient-to-r from-[#f0faf6] to-white px-4 py-3 text-sm font-semibold text-black hover:bg-[#e6f5ef] [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <Table2 className="h-4 w-4 shrink-0 text-[#2f8f6a]" aria-hidden />
                {p.sheetName}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="space-y-3 border-t border-gray-100 px-4 py-4">
              <p className="text-[11px] font-medium leading-snug text-gray-700 whitespace-pre-line">
                {normCell(p.title)}
              </p>
              <PropositionTable proposition={table} />
            </div>
          </details>
          )
        })}
      </div>
    </div>
  )
}
