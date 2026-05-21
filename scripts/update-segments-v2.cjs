const fs   = require('fs')
const path = require('path')
const DATA_DIR = path.join(__dirname, '..', 'public', 'data')

const CUSTOMER_OWNERSHIP = ['Private Sector Customers','Public Sector Customers']
const CUSTOMER_OWNERSHIP_RATIOS = [0.62, 0.38]
const INSTITUTION_SIZE = ['Large Financial Institutions','Small and Medium Financial Institutions']
const INSTITUTION_SIZE_RATIOS = [0.60, 0.40]
const BFSI_INSTITUTION_TYPE = [
  'Banks','Insurance Companies','Asset Management Firms',
  'Private Equity and Venture Capital Firms','Pension Funds and Sovereign Wealth Funds',
  'Microfinance Institutions','Fintech and Digital Financial Service Providers',
  'Development Finance Institutions',
  'Others (Credit Unions, Leasing Companies, Brokerage Firms, and Payment Service Providers)'
]
const BFSI_RATIOS = [0.20,0.15,0.14,0.12,0.10,0.06,0.09,0.09,0.05]

function totalPerYear(subSegs) {
  const yrs = Object.keys(Object.values(subSegs)[0]||{})
  const t = {}
  yrs.forEach(y => { t[y]=0; Object.values(subSegs).forEach(ts => t[y]+=(ts[y]||0)) })
  return t
}
function split(total, names, ratios) {
  const r = {}
  names.forEach((n,i) => { r[n]={}; Object.entries(total).forEach(([y,v]) => r[n][y]=Math.round(v*ratios[i]*10)/10) })
  return r
}
function transform(gsd) {
  const o = {}
  if (gsd['By Service Type'])   o['By Service Type']   = gsd['By Service Type']
  if (gsd['By Delivery Model']) o['By Delivery Model'] = gsd['By Delivery Model']
  const orgSrc = gsd['By Organization Size']
  if (orgSrc) {
    const t = totalPerYear(orgSrc)
    o['By Customer Ownership Type'] = split(t, CUSTOMER_OWNERSHIP, CUSTOMER_OWNERSHIP_RATIOS)
    o['By Institution Size']        = split(t, INSTITUTION_SIZE, INSTITUTION_SIZE_RATIOS)
  }
  const indSrc = gsd['By Industry Vertical']
  if (indSrc) {
    const t = totalPerYear(indSrc)
    o['By BFSI Institution Type'] = split(t, BFSI_INSTITUTION_TYPE, BFSI_RATIOS)
  }
  return o
}

function transformFile(fp) {
  const raw = JSON.parse(fs.readFileSync(fp,'utf8'))
  const result = {}
  for (const [geo, sd] of Object.entries(raw)) result[geo] = transform(sd)
  fs.writeFileSync(fp, JSON.stringify(result,null,2),'utf8')
  const st = result[Object.keys(result)[0]]
  console.log('Updated', path.basename(fp), '-', Object.keys(st||{}).join(', '))
}

function updateSeg() {
  const fp  = path.join(DATA_DIR, 'segmentation_analysis.json')
  const raw = JSON.parse(fs.readFileSync(fp,'utf8'))
  const result = {}
  for (const [geo, st] of Object.entries(raw)) {
    result[geo] = {}
    if (st['By Region']) result[geo]['By Region'] = st['By Region']
    result[geo]['By Service Type'] = {}
    ;['ESG Strategy, Governance and Roadmap Advisory','Climate Change, Decarbonization and Net-Zero Advisory','ESG Reporting, Disclosure and Framework Alignment Advisory','ESG Regulatory Compliance and Assurance Readiness Advisory','ESG Risk, Due Diligence and Transaction Advisory','ESG Data, Ratings, Benchmarking and Performance Monitoring Advisory','Sustainable Supply Chain, Human Rights and Social Impact Advisory','Others (Biodiversity Advisory, Circular Economy Advisory, Sustainable Finance Advisory, Green Building Advisory, and ESG Training Services)'].forEach(s => result[geo]['By Service Type'][s]={})
    result[geo]['By Delivery Model'] = {}
    ;['On-site Advisory','Remote Advisory','Hybrid Advisory'].forEach(s => result[geo]['By Delivery Model'][s]={})
    result[geo]['By Customer Ownership Type'] = {}
    CUSTOMER_OWNERSHIP.forEach(s => result[geo]['By Customer Ownership Type'][s]={})
    result[geo]['By Institution Size'] = {}
    INSTITUTION_SIZE.forEach(s => result[geo]['By Institution Size'][s]={})
    result[geo]['By BFSI Institution Type'] = {}
    BFSI_INSTITUTION_TYPE.forEach(s => result[geo]['By BFSI Institution Type'][s]={})
  }
  fs.writeFileSync(fp, JSON.stringify(result,null,2),'utf8')
  console.log('Updated segmentation_analysis.json')
}

console.log('Updating segments to final ESG structure...')
transformFile(path.join(DATA_DIR, 'value.json'))
transformFile(path.join(DATA_DIR, 'volume.json'))
updateSeg()
console.log('Done!')
