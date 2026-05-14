/**
 * Export CMI Customer Intelligence proposition sheets to public JSON.
 * Usage: node scripts/export-cmi-json.cjs [path-to-workbook.xlsx]
 * Default: Copy of Sample Framework Customer Database_Global Park Lock Actuators Market_CMI.xlsx
 */
const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')

const input = path.resolve(
  process.argv[2] ||
    'Copy of Sample Framework Customer Database_Global Park Lock Actuators Market_CMI.xlsx'
)
const outPath = path.join(__dirname, '..', 'public', 'data', 'cmi-customer-intelligence.json')

/** Workbooks may use "Proposition 1 - Basic" or "Proposition 1- Basic", etc. */
function resolveSheetName(workbook, index) {
  const names = workbook.SheetNames
  const preds = [
    (n) => /proposition\s*1/i.test(n) && /basic/i.test(n),
    (n) => /proposition\s*2/i.test(n) && /advance/i.test(n),
    (n) => /proposition\s*3/i.test(n) && /premium/i.test(n),
  ]
  const pred = preds[index]
  return names.find(pred) || null
}

function normCell(value) {
  return String(value ?? '')
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .trim()
}

function sanitizeHeaderRow1(row) {
  return row.map((c) =>
    String(c ?? '').replace(/Sports Management Software Buying Drivers/gi, 'Strategic buying drivers')
  )
}

function trimTrailingEmptyColumns(proposition) {
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
  const slice = (row, len) => row.slice(0, len)
  return {
    ...proposition,
    headerRow1: slice(headerRow1, maxLen),
    headerRow2: slice(headerRow2, maxLen),
    dataRows: dataRows.map((r) => slice([...r], maxLen)),
  }
}

const displaySheetNames = ['Proposition 1 - Basic', 'Proposition 2 - Advance', 'Proposition 3 - Premium']

const wb = XLSX.readFile(input)
const out = { source: path.basename(input), propositions: [] }

displaySheetNames.forEach((displayName, i) => {
  const name = resolveSheetName(wb, i)
  if (!name) {
    console.warn('Missing proposition sheet for index', i + 1)
    return
  }
  const s = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json(s, { header: 1, defval: '' })
  const title = rows[0] && rows[0][0] ? String(rows[0][0]) : ''
  const headerRow1 = sanitizeHeaderRow1(rows[4] || [])
  const headerRow2 = rows[5] || []
  const dataRows = rows.slice(6).filter((r) => r.some((c) => String(c).trim() !== ''))
  const raw = {
    id: i + 1,
    sheetName: displayName,
    title,
    headerRow1,
    headerRow2,
    dataRows,
  }
  out.propositions.push(trimTrailingEmptyColumns(raw))
})

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(out, null, 2))
console.log('Wrote', outPath, 'from', input)
