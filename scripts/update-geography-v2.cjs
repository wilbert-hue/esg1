/**
 * Flatten geography: keep only top-level regions + Africa sub-countries
 * Remove all other country-level entries (U.S., Canada, U.K., etc.)
 * Africa countries: South Africa, Kenya, Nigeria, Egypt, Morocco, Mauritius,
 *                   Ghana, Rwanda, Uganda, Tanzania, Rest of Africa
 */
const fs   = require('fs')
const path = require('path')
const DATA_DIR = path.join(__dirname, '..', 'public', 'data')

const AFRICA_COUNTRIES = [
  'South Africa', 'Kenya', 'Nigeria', 'Egypt', 'Morocco',
  'Mauritius', 'Ghana', 'Rwanda', 'Uganda', 'Tanzania', 'Rest of Africa'
]
const AFRICA_RATIOS = [0.20, 0.12, 0.15, 0.12, 0.08, 0.04, 0.07, 0.04, 0.05, 0.06, 0.07]

// Regions to keep at top level (no sub-countries)
const TOP_LEVEL_REGIONS = ['North America','Europe','Asia Pacific','Latin America','Middle East','Africa']

function mulReg(data, f) {
  const o = {}
  for (const [st, ss] of Object.entries(data)) {
    o[st] = {}
    for (const [s, ts] of Object.entries(ss)) {
      o[st][s] = {}
      for (const [y, v] of Object.entries(ts)) o[st][s][y] = Math.round(v * f * 10) / 10
    }
  }
  return o
}

function transformFile(fp) {
  const raw = JSON.parse(fs.readFileSync(fp, 'utf8'))
  const result = {}

  // Keep only top-level regions
  for (const region of TOP_LEVEL_REGIONS) {
    if (raw[region]) result[region] = raw[region]
  }

  // Add Africa sub-countries derived from Africa region data
  const africaData = raw['Africa']
  if (africaData) {
    AFRICA_COUNTRIES.forEach((country, i) => {
      result[country] = mulReg(africaData, AFRICA_RATIOS[i])
    })
  }

  fs.writeFileSync(fp, JSON.stringify(result, null, 2), 'utf8')
  console.log(`Updated ${path.basename(fp)} - geographies: ${Object.keys(result).join(', ')}`)
}

function updateSegmentation() {
  const fp  = path.join(DATA_DIR, 'segmentation_analysis.json')
  const raw = JSON.parse(fs.readFileSync(fp, 'utf8'))
  const result = {}

  for (const [geo, st] of Object.entries(raw)) {
    result[geo] = {}
    for (const [k, v] of Object.entries(st)) {
      if (k === 'By Region') {
        result[geo]['By Region'] = {
          'North America': {},
          'Europe':        {},
          'Asia Pacific':  {},
          'Latin America': {},
          'Middle East':   {},
          'Africa': Object.fromEntries(AFRICA_COUNTRIES.map(c => [c, {}]))
        }
      } else {
        result[geo][k] = v
      }
    }
  }

  fs.writeFileSync(fp, JSON.stringify(result, null, 2), 'utf8')
  console.log('Updated segmentation_analysis.json')
  console.log('Africa countries:', AFRICA_COUNTRIES.join(', '))
}

console.log('Flattening geography hierarchy...')
transformFile(path.join(DATA_DIR, 'value.json'))
transformFile(path.join(DATA_DIR, 'volume.json'))
updateSegmentation()
console.log('Done!')
