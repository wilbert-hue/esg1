const fs = require('fs')
const path = require('path')
const DATA_DIR = path.join(__dirname, '..', 'public', 'data')

const ME_RATIO = 0.55
const AF_RATIO = 0.45
const ME_COUNTRY_RATIOS = { 'GCC': 0.55, 'Israel': 0.25, 'Rest of Middle East': 0.20 }
const AF_COUNTRY_RATIOS = { 'Kenya': 0.28, 'Uganda': 0.20, 'Tanzania': 0.22, 'Rwanda': 0.12, 'Rest of Africa': 0.18 }

function multiplyTS(ts, f) {
  const r = {}
  for (const [y, v] of Object.entries(ts)) r[y] = Math.round(v * f * 10) / 10
  return r
}
function addTS(a, b) {
  const r = {}
  for (const y of new Set([...Object.keys(a), ...Object.keys(b)])) r[y] = Math.round(((a[y]||0)+(b[y]||0))*10)/10
  return r
}
function mulReg(data, f) {
  const o = {}
  for (const [st, ss] of Object.entries(data)) { o[st] = {}; for (const [s, ts] of Object.entries(ss)) o[st][s] = multiplyTS(ts, f) }
  return o
}
function addReg(a, b) {
  const o = {}
  for (const st of new Set([...Object.keys(a), ...Object.keys(b)])) {
    o[st] = {}
    for (const s of new Set([...Object.keys(a[st]||{}), ...Object.keys(b[st]||{})])) o[st][s] = addTS((a[st]||{})[s]||{}, (b[st]||{})[s]||{})
  }
  return o
}

function transformFile(fp) {
  const raw = JSON.parse(fs.readFileSync(fp, 'utf8'))
  const result = {}
  const OLD = new Set(['Middle East & Africa','GCC','South Africa','Rest of Middle East & Africa'])
  for (const [geo, sd] of Object.entries(raw)) { if (!OLD.has(geo)) result[geo] = sd }
  const mea = raw['Middle East & Africa']
  const gcc = raw['GCC']
  const sa  = raw['South Africa']
  const rme = raw['Rest of Middle East & Africa']
  if (!mea) { fs.writeFileSync(fp, JSON.stringify(result,null,2),'utf8'); return }
  result['Middle East'] = mulReg(mea, ME_RATIO)
  result['Africa']      = mulReg(mea, AF_RATIO)
  result['GCC']         = gcc
  result['Israel']      = mulReg(sa, 0.40)
  result['Rest of Middle East'] = mulReg(rme, 0.50)
  const afPool = addReg(mulReg(sa, 0.60), mulReg(rme, 0.50))
  for (const [c, r] of Object.entries(AF_COUNTRY_RATIOS)) result[c] = mulReg(afPool, r)
  fs.writeFileSync(fp, JSON.stringify(result,null,2),'utf8')
  console.log('Updated', path.basename(fp), '- geographies:', Object.keys(result).length)
}

function updateSeg() {
  const fp  = path.join(DATA_DIR, 'segmentation_analysis.json')
  const raw = JSON.parse(fs.readFileSync(fp, 'utf8'))
  const result = {}
  for (const [geo, st] of Object.entries(raw)) {
    result[geo] = {}
    for (const [k, v] of Object.entries(st)) {
      if (k === 'By Region') {
        result[geo]['By Region'] = {
          'North America': {'U.S.':{}, 'Canada':{}},
          'Europe': {'U.K.':{}, 'Germany':{}, 'Italy':{}, 'France':{}, 'Spain':{}, 'Russia':{}, 'Rest of Europe':{}},
          'Asia Pacific': {'China':{}, 'India':{}, 'Japan':{}, 'South Korea':{}, 'ASEAN':{}, 'Australia':{}, 'Rest of Asia Pacific':{}},
          'Latin America': {'Brazil':{}, 'Argentina':{}, 'Mexico':{}, 'Rest of Latin America':{}},
          'Middle East': {'GCC':{}, 'Israel':{}, 'Rest of Middle East':{}},
          'Africa': {'Kenya':{}, 'Uganda':{}, 'Tanzania':{}, 'Rwanda':{}, 'Rest of Africa':{}}
        }
      } else {
        result[geo][k] = v
      }
    }
  }
  fs.writeFileSync(fp, JSON.stringify(result,null,2),'utf8')
  console.log('Updated segmentation_analysis.json')
}

console.log('Updating geography...')
transformFile(path.join(DATA_DIR, 'value.json'))
transformFile(path.join(DATA_DIR, 'volume.json'))
updateSeg()
console.log('Done!')
