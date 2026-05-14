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

/** Known template typos in CMI workbooks — replace for display/export only. */
const HEADER_ROW1_REPLACEMENTS: [RegExp, string][] = [
  [/Sports Management Software Buying Drivers/gi, 'Strategic buying drivers'],
]

export function sanitizeMislabeledGroupHeaders(proposition: CmiProposition): CmiProposition {
  const headerRow1 = proposition.headerRow1.map((cell) => {
    let s = String(cell ?? '')
    for (const [re, rep] of HEADER_ROW1_REPLACEMENTS) {
      s = s.replace(re, rep)
    }
    return s
  })
  const unchanged = headerRow1.every((c, i) => c === String(proposition.headerRow1[i] ?? ''))
  return unchanged ? proposition : { ...proposition, headerRow1 }
}

/**
 * Drop trailing columns where Excel padded the row length (empty level-1 & level-2 headers and no cell data).
 * Keeps columns that only have row-2 text (merged row-1 pattern) or any non-empty data.
 */
export function trimTrailingEmptyColumns(proposition: CmiProposition): CmiProposition {
  const { headerRow1, headerRow2, dataRows } = proposition
  const prevMax = Math.max(
    headerRow1.length,
    headerRow2.length,
    ...dataRows.map((r) => r.length),
    0
  )
  let maxLen = prevMax
  while (maxLen > 0) {
    const i = maxLen - 1
    const top = normCell(headerRow1[i])
    const sub = normCell(headerRow2[i])
    const colEmpty = dataRows.every((row) => normCell(row[i]) === '')
    if (top || sub || !colEmpty) break
    maxLen--
  }
  if (maxLen === prevMax) return proposition
  const slice = <T,>(row: T[], len: number): T[] => row.slice(0, len)
  return {
    ...proposition,
    headerRow1: slice(headerRow1, maxLen),
    headerRow2: slice(headerRow2, maxLen),
    dataRows: dataRows.map((r) => slice([...r], maxLen) as (string | number)[]),
  }
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
