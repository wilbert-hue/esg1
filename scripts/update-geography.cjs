/**
 * Update geography: split "Middle East & Africa" into "Middle East" and "Africa"
 * with new sub-countries as per the new ESG market structure
 */

const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'public', 'data')

// New geography structure
// Middle East: GCC, Israel, Rest of Middle East
// Africa: Kenya, Uganda, Tanzania, Rwanda, Rest of Africa

// Ratios for splitting old "Middle East & Africa" region total
const ME_RATIO   = 0.55  // Middle East share of old MEA
const AF_RATIO   = 0.45  // Africa share of old MEA

// Ratios within Middle East countries (must sum to 1)
const ME_COUNTRY_RATIOS = {
  'GCC':               0.55,
  'Israel':            0.25,
  'Rest of Middle East': 0.20,
}

// Ratios within Africa countries (must sum to 1)
const AF_COUNTRY_RATIOS = {
  'Kenya':          0.28,
  'Uganda':         0.20,
  'Tanzania':       0.22,
  'Rwanda':         0.12,
  'Rest of Africa': 0.18,
}

function multiplyTimeSeries(ts, factor) {
  const result = {}
  for (const [yr, val] of Object.entries(ts)) {
    result[yr] = Math.round(val * factor * 10) / 10
  }
  return result
}

function addTimeSeries(a, b) {
  const result = {}
  const years = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const yr of years) {
    result[yr] = Math.round(((a[yr] || 0) + (b[yr] || 0)) * 10) / 10
  }
  return result
}

function transformDataFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const result = {}

  // -- Copy everything that is NOT old MEA geographies --
  const OLD_MEA_KEYS = new Set([
    'Middle East & Africa',
    'GCC',
    'South Africa',
    'Rest of Middle East & Africa',
  ])

  for (const [geo, segData] of Object.entries(raw)) {
    if (!OLD_MEA_KEYS.has(geo)) {
      result[geo] = segData
    }
  }

  // -- Compute new MEA geographies --
  const meaRegionData  = raw['Middle East & Africa']   // region aggregate
  const gccData        = raw['GCC']
  const southAfricaData = raw['South Africa']
  const restMeaData    = raw['Rest of Middle East & Africa']

  if (!meaRegionData) {
    console.warn('⚠️  "Middle East & Africa" not found in', filePath)
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8')
    return
  }

  // Helper: for each segment type, apply per-year transformation
  function transformRegionData(sourceData, factor) {
    const out = {}
    for (const [segType, subSegs] of Object.entries(sourceData)) {
      out[segType] = {}
      for (const [seg, ts] of Object.entries(subSegs)) {
        out[segType][seg] = multiplyTimeSeries(ts, factor)
      }
    }
    return out
  }

  function addRegionData(a, b) {
    const out = {}
    const segTypes = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const st of segTypes) {
      out[st] = {}
      const segs = new Set([...Object.keys(a[st] || {}), ...Object.keys(b[st] || {})])
      for (const seg of segs) {
        out[st][seg] = addTimeSeries(
          (a[st] || {})[seg] || {},
          (b[st] || {})[seg] || {}
        )
      }
    }
    return out
  }

  // Middle East region = 55% of old MEA region
  result['Middle East'] = transformRegionData(meaRegionData, ME_RATIO)

  // Africa region = 45% of old MEA region
  result['Africa'] = transformRegionData(meaRegionData, AF_RATIO)

  // Middle East countries
  // GCC: keep existing GCC data (it was a Middle East country)
  result['GCC'] = gccData

  // Israel: take 25% of old South Africa data (demo redistribution)
  result['Israel'] = transformRegionData(southAfricaData, 0.40)

  // Rest of Middle East: 50% of old "Rest of MEA"
  result['Rest of Middle East'] = transformRegionData(restMeaData, 0.50)

  // Africa countries - distribute from old South Africa + 50% of old Rest of MEA
  // Pool = old South Africa * 0.60 + old Rest of MEA * 0.50
  const africaPool = addRegionData(
    transformRegionData(southAfricaData, 0.60),
    transformRegionData(restMeaData, 0.50)
  )

  for (const [country, ratio] of Object.entries(AF_COUNTRY_RATIOS)) {
    result[country] = transformRegionData(africaPool, ratio)
  }

  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8')
  console.log(`✅ Updated geography in: ${filePath}`)
  console.log(`   New geographies: ${Object.keys(result).join(', ')}`)
}

function updateSegmentationAnalysis() {
  const segFilePath = path.join(DATA_DIR, 'segmentation_analysis.json')
  const raw = JSON.parse(fs.readFileSync(segFilePath, 'utf8'))

  const result = {}
  for (const [geo, segTypes] of Object.entries(raw)) {
    result[geo] = {}
    for (const [segType, val] of Object.entries(segTypes)) {
      if (segType === 'By Region') {
        // Replace old MEA with new split structure
        result[geo]['By Region'] = {
          'North America': { 'U.S.': {}, 'Canada': {} },
          'Europe': {
            'U.K.': {}, 'Germany': {}, 'Italy': {},
            'France': {}, 'Spain': {}, 'Russia': {}, 'Rest of Europe': {}
          },
          'Asia Pacific': {
            'China': {}, 'India': {}, 'Japan': {},
            'South Korea': {}, 'ASEAN': {}, 'Australia': {}, 'Rest of Asia Pacific': {}
          },
          'Latin America': {
            'Brazil': {}, 'Argentina': {}, 'Mexico': {}, 'Rest of Latin America': {}
          },
          'Middle East': {
            'GCC': {}, 'Israel': {}, 'Rest of Middle East': {}
          },
          'Africa': {
            'Kenya': {}, 'Uganda': {}, 'Tanzania': {}, 'Rwanda': {}, 'Rest of Africa': {}
          }
        }
      } else {
        result[geo][segType] = val
      }
    }
  }

  fs.writeFileSync(segFilePath, JSON.stringify(result, null, 2), 'utf8')
  console.log(`✅ Updated segmentation_analysis.json`)
}

console.log('🌍 Updating geography structure...')
transformDataFile(path.join(DATA_DIR, 'value.json'))
transformDataFile(path.join(DATA_DIR, 'volume.json'))
updateSegmentationAnalysis()
console.log('\n✨ Geography update complete!')
