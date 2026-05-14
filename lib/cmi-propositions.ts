/**
 * Types and helpers for CMI Customer Intelligence proposition tables
 * (exported from Sample Framework_Customer Database_*_CMI.xlsx).
 */

export interface CmiProposition {
  id: number
  sheetName: string
  title: string
  headerRow1: string[]
  headerRow2: string[]
  dataRows: (string | number)[][]
}

export interface CmiCustomerIntelligencePayload {
  source: string
  propositions: CmiProposition[]
}

export function normCell(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .trim()
}

/** Build level-1 header cells with colspans from Excel merge pattern (label followed by blanks). */
export function parseGroupedHeader(row1: string[]): { label: string; colspan: number }[] {
  const cells: { label: string; colspan: number }[] = []
  const n = row1.length
  let i = 0
  while (i < n) {
    const label = normCell(row1[i])
    if (label) {
      let span = 1
      i++
      while (i < n && !normCell(row1[i])) {
        span++
        i++
      }
      cells.push({ label, colspan: span })
    } else {
      i++
    }
  }
  return cells
}

export function padRow(row: (string | number)[], len: number): string[] {
  const out: string[] = []
  for (let c = 0; c < len; c++) {
    out.push(normCell(row[c] ?? ''))
  }
  return out
}

/**
 * Remove a level-1 column group (e.g. "Professional Drivers") and its sub-columns.
 * Used for Proposition 1 — Basic to show only Customer Information + Contact Details.
 */
export function stripColumnGroupByLabel(
  proposition: CmiProposition,
  groupLabel: string
): CmiProposition {
  const row1Norm = proposition.headerRow1.map((c) => normCell(c))
  const groups = parseGroupedHeader(row1Norm)
  const needle = normCell(groupLabel).toLowerCase()
  let offset = 0
  for (const g of groups) {
    const lab = normCell(g.label).toLowerCase()
    if (lab === needle || lab.includes(needle)) {
      const start = offset
      const end = offset + g.colspan
      const cut = <T,>(row: T[]): T[] => [...row.slice(0, start), ...row.slice(end)]
      return {
        ...proposition,
        headerRow1: cut(proposition.headerRow1),
        headerRow2: cut(proposition.headerRow2),
        dataRows: proposition.dataRows.map((r) => cut([...r]) as (string | number)[]),
      }
    }
    offset += g.colspan
  }
  return proposition
}
