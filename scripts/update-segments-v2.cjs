/**
 * Update segments to final ESG structure:
 *  1. By Service Type        – keep (8 sub-segments, already correct)
 *  2. By Delivery Model      – keep (3 sub-segments, already correct)
 *  3. By Customer Ownership Type  – was "By Organization Size"
 *  4. By Institution Size    – NEW (derived from org-size data)
 *  5. By BFSI Institution Type – was "By Industry Vertical"
 */

const fs   = require('fs')
const path = require('path')
const DATA_DIR = path.join(__dirname, '..', 'public', 'data')

// ── New sub-segment definitions ────────────────────────────────────────────

const CUSTOMER_OWNERSHIP = [
  'Private Sector Customers',
  'Public Sector Customers',
]
const CUSTOMER_OWNERSHIP_RATIOS = [0.62, 0.38]

const INSTITUTION_SIZE = [
  'Large Financial Institutions',
  'Small and Medium Financial Institutions',
]
const INSTITUTION_SIZE_RATIOS = [0.60, 0.40]

const BFSI_INSTITUTION_TYPE = [
  'Banks',
  'Insurance Companies',
  'Asset Management Firms',
  'Private Equity and Venture Capital Firms',
  'Pension Funds and Sovereign Wealth Funds',
  'Microfinance Institutions',
  'Fintech and Digital Financial Service Providers',
  'Development Finance Institutions',
  'Others (Credit Unions, Leasing Companies, Brokerage Firms, and Payment Service Providers)',
]
const BFSI_RATIOS = [0.20, 0.15, 0.14, 0.12, 0.10, 0.06, 0.09, 0.09, 0.05]

// ── Helpers ────────────────────────────────────────────────────────────────

function getTotalPerYear(subSegs) {
  const years = Object.keys(Object.values(subSegs)[0] || {})
  const total = {}
  years.forEach(yr => {
    total[yr] = 0
    Object.values(subSegs).forEach(ts => { total[yr] += (ts[yr] || 0) })
  })
  return total
}

function splitTotal(total, names, ratios) {
  const result = {}
  names.forEach((name, i) => {
    result[name] = {}
    Object.entries(total).forEach(([yr, val]) => {
      result[name][yr] = Math.round(val * ratios[i] * 10) / 10
    })
  })
  return result
}

function transformGeoData(geoSegData) {
  const out = {}

  // ── 1 & 2. Keep By Service Type and By Delivery Model as-is ──────────────
  if (geoSegData['By Service Type'])   out['By Service Type']   = geoSegData['By Service Type']
  if (geoSegData['By Delivery Model']) out['By Delivery Model'] = geoSegData['By Delivery Model']

  // ── 3. By Customer Ownership Type (was By Organization Size) ─────────────
  const orgSrc = geoSegData['By Organization Size']
  if (orgSrc) {
    const total = getTotalPerYear(orgSrc)
    out['By Customer Ownership Type'] = splitTotal(total, CUSTOMER_OWNERSHIP, CUSTOMER_OWNERSHIP_RATIOS)
  }

  // ── 4. By Institution Size (NEW – derived from same org-size pool) ────────
  if (orgSrc) {
    const total = getTotalPerYear(orgSrc)
    out['By Institution Size'] = splitTotal(total, INSTITUTION_SIZE, INSTITUTION_SIZE_RATIOS)
  }

  // ── 5. By BFSI Institution Type (was By Industry Vertical) ───────────────
  const indSrc = geoSegData['By Industry Vertical']
  if (indSrc) {
    const total = getTotalPerYear(indSrc)
    out['By BFSI Institution Type'] = splitTotal(total, BFSI_INSTITUTION_TYPE, BFSI_RATIOS)
  }

  return out
}

// ── Transform value.json / volume.json ─────────────────────────────────────

function transformDataFile(filePath) {
  const raw  = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const result = {}
  for (const [geo, segData] of Object.entries(raw)) {
    result[geo] = transformGeoData(segData)
  }
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8')
  const sampleSegTypes = result[Object.keys(result)[0]] ? Object.keys(result[Object.keys(result)[0]]) : []
  console.log(`✅ ${path.basename(filePath)} – segment types: ${sampleSegTypes.join(', ')}`)
}

// ── Update segmentation_analysis.json ──────────────────────────────────────

function updateSegmentation() {
  const fp  = path.join(DATA_DIR, 'segmentation_analysis.json')
  const raw = JSON.parse(fs.readFileSync(fp, 'utf8'))
  const result = {}

  for (const [geo, segTypes] of Object.entries(raw)) {
    result[geo] = {}

    // Keep By Region for geography hierarchy
    if (segTypes['By Region']) result[geo]['By Region'] = segTypes['By Region']

    result[geo]['By Service Type'] = {}
    ;[
      'ESG Strategy, Governance and Roadmap Advisory',
      'Climate Change, Decarbonization and Net-Zero Advisory',
      'ESG Reporting, Disclosure and Framework Alignment Advisory',
      'ESG Regulatory Compliance and Assurance Readiness Advisory',
      'ESG Risk, Due Diligence and Transaction Advisory',
      'ESG Data, Ratings, Benchmarking and Performance Monitoring Advisory',
      'Sustainable Supply Chain, Human Rights and Social Impact Advisory',
      'Others (Biodiversity Advisory, Circular Economy Advisory, Sustainable Finance Advisory, Green Building Advisory, and ESG Training Services)',
    ].forEach(s => { result[geo]['By Service Type'][s] = {} })

    result[geo]['By Delivery Model'] = {}
    ;['On-site Advisory', 'Remote Advisory', 'Hybrid Advisory']
      .forEach(s => { result[geo]['By Delivery Model'][s] = {} })

    result[geo]['By Customer Ownership Type'] = {}
    CUSTOMER_OWNERSHIP.forEach(s => { result[geo]['By Customer Ownership Type'][s] = {} })

    result[geo]['By Institution Size'] = {}
    INSTITUTION_SIZE.forEach(s => { result[geo]['By Institution Size'][s] = {} })

    result[geo]['By BFSI Institution Type'] = {}
    BFSI_INSTITUTION_TYPE.forEach(s => { result[geo]['By BFSI Institution Type'][s] = {} })
  }

  fs.writeFileSync(fp, JSON.stringify(result, null, 2), 'utf8')
  console.log('✅ segmentation_analysis.json updated')
}

// ── Run ─────────────────────────────────────────────────────────────────────
console.log('🚀 Updating to final ESG segment structure...')
transformDataFile(path.join(DATA_DIR, 'value.json'))
transformDataFile(path.join(DATA_DIR, 'volume.json'))
updateSegmentation()
console.log('✨ Done!')
