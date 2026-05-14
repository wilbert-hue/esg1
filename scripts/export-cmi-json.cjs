/**
 * Export CMI Customer Intelligence proposition sheets to public JSON.
 * Usage: node scripts/export-cmi-json.cjs [path-to-workbook.xlsx]
 * Default: Sample Framework_Customer Database_Global Oil And Gas Security Market_CMI.xlsx
 */
const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')

const input = path.resolve(process.argv[2] || 'Sample Framework_Customer Database_Global Oil And Gas Security Market_CMI.xlsx')
const outPath = path.join(__dirname, '..', 'public', 'data', 'cmi-customer-intelligence.json')

const wb = XLSX.readFile(input)
const sheetNames = ['Proposition 1 - Basic', 'Proposition 2 - Advance', 'Proposition 3 - Premium']
const out = { source: path.basename(input), propositions: [] }

sheetNames.forEach((name, i) => {
  const s = wb.Sheets[name]
  if (!s) {
    console.warn('Missing sheet:', name)
    return
  }
  const rows = XLSX.utils.sheet_to_json(s, { header: 1, defval: '' })
  const title = rows[0] && rows[0][0] ? String(rows[0][0]) : ''
  const headerRow1 = rows[4] || []
  const headerRow2 = rows[5] || []
  const dataRows = rows.slice(6).filter((r) => r.some((c) => String(c).trim() !== ''))
  out.propositions.push({
    id: i + 1,
    sheetName: name,
    title,
    headerRow1,
    headerRow2,
    dataRows,
  })
})

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(out, null, 2))
console.log('Wrote', outPath, 'from', input)
