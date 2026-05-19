/**
 * Transform Park Lock Actuators data → ESG & Sustainability Advisory Market data
 * Also extracts CMI headers from the ESG Excel file
 */

const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const DATA_DIR = path.join(__dirname, '..', 'public', 'data')
const ROOT_DIR = path.join(__dirname, '..')
const ESG_EXCEL = path.join(ROOT_DIR, 'Sample Framework_Customer Database_Global ESG & Sustainability Advisory Market.xlsx')

// ─────────────────────────────────────────────────────────────────────────────
// Segment type mapping: old name → new ESG name
// ─────────────────────────────────────────────────────────────────────────────
const SEGMENT_TYPE_MAP = {
  'By Actuation Technology': 'By Service Type',
  'By Motion Output Type': 'By Delivery Model',
  'By Sales Channel': 'By Organization Size',
  'By Transmission and Driveline Application': 'By Industry Vertical',
  // 'By Vehicle Type' → DROPPED
}

// New ESG sub-segments for each segment type
const ESG_SERVICE_TYPE = [
  'ESG Strategy, Governance and Roadmap Advisory',
  'Climate Change, Decarbonization and Net-Zero Advisory',
  'ESG Reporting, Disclosure and Framework Alignment Advisory',
  'ESG Regulatory Compliance and Assurance Readiness Advisory',
  'ESG Risk, Due Diligence and Transaction Advisory',
  'ESG Data, Ratings, Benchmarking and Performance Monitoring Advisory',
  'Sustainable Supply Chain, Human Rights and Social Impact Advisory',
  'Others (Biodiversity Advisory, Circular Economy Advisory, Sustainable Finance Advisory, Green Building Advisory, and ESG Training Services)',
]
const ESG_SERVICE_TYPE_RATIOS = [0.20, 0.18, 0.15, 0.12, 0.11, 0.10, 0.08, 0.06]

const ESG_DELIVERY_MODEL = [
  'On-site Advisory',
  'Remote Advisory',
  'Hybrid Advisory',
]
const ESG_DELIVERY_MODEL_RATIOS = [0.45, 0.35, 0.20]

const ESG_ORG_SIZE = [
  'Large Enterprises',
  'Small & Medium Enterprises',
]

const ESG_INDUSTRY_VERTICAL = [
  'BFSI',
  'Oil & Gas',
  'Power, Utilities and Renewables',
  'Mining and Metals',
  'Manufacturing',
  'Retail and Consumer Goods',
  'Healthcare and Pharmaceuticals',
  'IT and Telecommunications',
  'Transportation and Logistics',
  'Construction and Real Estate',
  'Government and Public Sector',
  'Food and Agriculture',
  'Others (Education, Hospitality, Media, and Nonprofit Organizations)',
]
const ESG_INDUSTRY_VERTICAL_RATIOS = [0.14, 0.12, 0.10, 0.09, 0.09, 0.08, 0.07, 0.07, 0.06, 0.06, 0.06, 0.04, 0.02]

// Map old sub-segment → new sub-segments with split ratios
function transformSegmentData(oldSegmentType, oldSubSegments) {
  // oldSubSegments: { "sub-segment-name": { "2021": val, ... }, ... }
  
  // Compute total per year across all old sub-segments
  const years = Object.keys(Object.values(oldSubSegments)[0] || {})
  const totalPerYear = {}
  years.forEach(yr => {
    totalPerYear[yr] = 0
    Object.values(oldSubSegments).forEach(timeSeries => {
      totalPerYear[yr] += (timeSeries[yr] || 0)
    })
  })

  let newSubSegments, ratios
  
  if (oldSegmentType === 'By Actuation Technology') {
    newSubSegments = ESG_SERVICE_TYPE
    ratios = ESG_SERVICE_TYPE_RATIOS
  } else if (oldSegmentType === 'By Motion Output Type') {
    newSubSegments = ESG_DELIVERY_MODEL
    ratios = ESG_DELIVERY_MODEL_RATIOS
  } else if (oldSegmentType === 'By Sales Channel') {
    // For Org Size, just rename (2→2)
    const oldKeys = Object.keys(oldSubSegments)
    const result = {}
    result[ESG_ORG_SIZE[0]] = oldSubSegments[oldKeys[0]] || {}
    result[ESG_ORG_SIZE[1]] = oldSubSegments[oldKeys[1]] || {}
    return result
  } else if (oldSegmentType === 'By Transmission and Driveline Application') {
    newSubSegments = ESG_INDUSTRY_VERTICAL
    ratios = ESG_INDUSTRY_VERTICAL_RATIOS
  } else {
    return null // drop
  }

  // Distribute total per year across new sub-segments using ratios
  const result = {}
  newSubSegments.forEach((seg, idx) => {
    result[seg] = {}
    years.forEach(yr => {
      result[seg][yr] = Math.round(totalPerYear[yr] * ratios[idx] * 10) / 10
    })
  })
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform value.json / volume.json
// ─────────────────────────────────────────────────────────────────────────────
function transformDataFile(inputPath, outputPath) {
  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
  const result = {}

  for (const [geo, segTypes] of Object.entries(raw)) {
    result[geo] = {}
    for (const [oldSegType, subSegs] of Object.entries(segTypes)) {
      if (oldSegType === 'By Vehicle Type' || oldSegType === 'By Region') {
        continue // drop these segment types
      }
      const newSegType = SEGMENT_TYPE_MAP[oldSegType]
      if (!newSegType) {
        console.warn(`No mapping for segment type: ${oldSegType}`)
        continue
      }
      const transformed = transformSegmentData(oldSegType, subSegs)
      if (transformed) {
        result[geo][newSegType] = transformed
      }
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8')
  console.log(`✅ Transformed: ${outputPath}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Update segmentation_analysis.json
// ─────────────────────────────────────────────────────────────────────────────
function updateSegmentationAnalysis() {
  const segFilePath = path.join(DATA_DIR, 'segmentation_analysis.json')
  const raw = JSON.parse(fs.readFileSync(segFilePath, 'utf8'))
  
  const result = {}
  for (const [geo, segTypes] of Object.entries(raw)) {
    result[geo] = {}
    
    // By Service Type (was By Actuation Technology)
    result[geo]['By Service Type'] = {}
    ESG_SERVICE_TYPE.forEach(seg => { result[geo]['By Service Type'][seg] = {} })
    
    // By Delivery Model (was By Motion Output Type)
    result[geo]['By Delivery Model'] = {}
    ESG_DELIVERY_MODEL.forEach(seg => { result[geo]['By Delivery Model'][seg] = {} })
    
    // By Organization Size (was By Sales Channel)
    result[geo]['By Organization Size'] = {}
    ESG_ORG_SIZE.forEach(seg => { result[geo]['By Organization Size'][seg] = {} })
    
    // By Industry Vertical (was By Transmission and Driveline Application)
    result[geo]['By Industry Vertical'] = {}
    ESG_INDUSTRY_VERTICAL.forEach(seg => { result[geo]['By Industry Vertical'][seg] = {} })
    
    // Keep By Region as geography hierarchy
    if (raw[geo]['By Region']) {
      result[geo]['By Region'] = raw[geo]['By Region']
    }
  }
  
  fs.writeFileSync(segFilePath, JSON.stringify(result, null, 2), 'utf8')
  console.log(`✅ Updated: ${segFilePath}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Extract CMI headers from ESG Excel file and update cmi-customer-intelligence.json
// ─────────────────────────────────────────────────────────────────────────────
function updateCmiJson() {
  const cmiJsonPath = path.join(DATA_DIR, 'cmi-customer-intelligence.json')
  let excelData = null
  
  // Try to read the Excel file
  if (fs.existsSync(ESG_EXCEL)) {
    console.log(`📖 Reading ESG Excel: ${ESG_EXCEL}`)
    try {
      const workbook = XLSX.readFile(ESG_EXCEL)
      excelData = workbook
      console.log(`   Sheets found: ${workbook.SheetNames.join(', ')}`)
    } catch (e) {
      console.warn(`⚠️  Could not read Excel: ${e.message}`)
    }
  } else {
    console.warn(`⚠️  ESG Excel not found at: ${ESG_EXCEL}`)
  }

  // Define ESG-specific headers based on Excel structure
  // These match the "Sample Framework_Customer Database_Global ESG & Sustainability Advisory Market.xlsx"
  const ESG_TITLE_BASE = 'Global ESG & Sustainability Advisory Market - Customer Database\nVerified directory and insight on customers (ESG Consulting Firms, Sustainability Advisory Firms, Asset Managers & Institutional Investors, Corporates seeking ESG Advisory, ESG Rating Agencies, ESG Technology Providers, Regulatory Bodies & Government Agencies, etc.)'

  // Try to parse actual sheets from Excel if available
  let prop1Headers = null
  let prop2Headers = null
  let prop3Headers = null

  if (excelData) {
    // Look for sheet names matching Proposition 1/2/3 or Basic/Advance/Premium
    for (const sheetName of excelData.SheetNames) {
      const ws = excelData.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      
      if (rows.length < 2) continue
      
      const row1 = rows[0].map(c => String(c || ''))
      const row2 = rows[1].map(c => String(c || ''))
      
      console.log(`   Sheet "${sheetName}" header row 1:`, row1.slice(0, 10))
      console.log(`   Sheet "${sheetName}" header row 2:`, row2.slice(0, 10))
      
      const lname = sheetName.toLowerCase()
      if (lname.includes('basic') || lname.includes('prop') && lname.includes('1')) {
        prop1Headers = { row1, row2 }
      } else if (lname.includes('advance') || lname.includes('prop') && lname.includes('2')) {
        prop2Headers = { row1, row2 }
      } else if (lname.includes('premium') || lname.includes('prop') && lname.includes('3')) {
        prop3Headers = { row1, row2 }
      }
    }
    
    // If we couldn't match by name, use sheet order
    if (!prop1Headers && excelData.SheetNames.length >= 1) {
      const ws = excelData.Sheets[excelData.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (rows.length >= 2) {
        prop1Headers = {
          row1: rows[0].map(c => String(c || '')),
          row2: rows[1].map(c => String(c || ''))
        }
      }
    }
    if (!prop2Headers && excelData.SheetNames.length >= 2) {
      const ws = excelData.Sheets[excelData.SheetNames[1]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (rows.length >= 2) {
        prop2Headers = {
          row1: rows[0].map(c => String(c || '')),
          row2: rows[1].map(c => String(c || ''))
        }
      }
    }
    if (!prop3Headers && excelData.SheetNames.length >= 3) {
      const ws = excelData.Sheets[excelData.SheetNames[2]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (rows.length >= 2) {
        prop3Headers = {
          row1: rows[0].map(c => String(c || '')),
          row2: rows[1].map(c => String(c || ''))
        }
      }
    }
  }

  // Fallback ESG headers if Excel couldn't be read
  const fallbackProp1Row1 = [
    'S.No.', 'Customer Information', '', '', '', '', '', 'Contact Details', '', '', '', '', ''
  ]
  const fallbackProp1Row2 = [
    '', 'Customer Name / Company Name', 'Business Overview', 'Customer Type',
    'ESG Advisory Focus Area', 'Country / Region', 'Customer Size / Scale',
    'Key Contact Person', 'Designation / Role', 'Email Address',
    'Phone / WhatsApp Number', 'LinkedIn Profile', 'Website URL'
  ]

  const fallbackProp2Row1 = [
    'S.No.', 'Customer Information', '', '', '', '', '', 'Contact Details', '', '', '', '', '',
    'Strategic Buying Drivers', '', '', '', 'Purchasing Behaviour Metrics', '', '', ''
  ]
  const fallbackProp2Row2 = [
    '', 'Customer Name / Company Name', 'Business Overview', 'Customer Type',
    'ESG Advisory Focus Area', 'Country / Region', 'Customer Size / Scale',
    'Key Contact Person', 'Designation / Role', 'Email Address',
    'Phone / WhatsApp Number', 'LinkedIn Profile', 'Website URL',
    'Key Buying Criteria', 'Core ESG / Sustainability Pain Points',
    'Preferred ESG Advisory Service Type', 'Key Buying Triggers',
    'Budget Ownership', 'Procurement Model', 'Vendor Selection Criteria', 'Preferred Engagement Type'
  ]

  const fallbackProp3Row1 = [
    'S.No.', 'Customer Information', '', '', '', '', '', 'Contact Details', '', '', '', '', '',
    'Strategic Buying Drivers', '', '', '', 'Purchasing Behaviour Metrics', '', '', '',
    'Solution Requirements', '', '', '', 'CMI Insights on Customer Benchmarking Summary (Potential Customers)'
  ]
  const fallbackProp3Row2 = [
    '', 'Customer Name / Company Name', 'Business Overview', 'Customer Type',
    'ESG Advisory Focus Area', 'Country / Region', 'Customer Size / Scale',
    'Key Contact Person', 'Designation / Role', 'Email Address',
    'Phone / WhatsApp Number', 'LinkedIn Profile', 'Website URL',
    'Key Buying Criteria', 'Core ESG / Sustainability Pain Points',
    'Preferred ESG Advisory Service Type', 'Key Buying Triggers',
    'Budget Ownership', 'Procurement Model', 'Vendor Selection Criteria', 'Preferred Engagement Type',
    'Preferred Solution Type', 'ESG Reporting Framework Requirement',
    'Regulatory Compliance Requirement', 'Performance Expectations',
    'Customer Benchmarking Summary'
  ]

  // Use Excel data if available, otherwise use fallback
  const p1Row1 = (prop1Headers?.row1?.length > 1) ? prop1Headers.row1 : fallbackProp1Row1
  const p1Row2 = (prop1Headers?.row2?.length > 1) ? prop1Headers.row2 : fallbackProp1Row2
  const p2Row1 = (prop2Headers?.row1?.length > 1) ? prop2Headers.row1 : fallbackProp2Row1
  const p2Row2 = (prop2Headers?.row2?.length > 1) ? prop2Headers.row2 : fallbackProp2Row2
  const p3Row1 = (prop3Headers?.row1?.length > 1) ? prop3Headers.row1 : fallbackProp3Row1
  const p3Row2 = (prop3Headers?.row2?.length > 1) ? prop3Headers.row2 : fallbackProp3Row2

  // Generate data rows (placeholder xx values)
  function makeRows(colCount, rowCount = 15) {
    return Array.from({ length: rowCount }, (_, i) => {
      const row = [i + 1]
      const label = i < rowCount - 1 ? `Customer ${i + 1}` : 'Customer N'
      row.push(label)
      for (let c = 2; c < colCount; c++) row.push('xx')
      return row
    })
  }

  const cmiJson = {
    source: 'Sample Framework_Customer Database_Global ESG & Sustainability Advisory Market.xlsx',
    propositions: [
      {
        id: 1,
        sheetName: 'Proposition 1 - Basic',
        title: ESG_TITLE_BASE,
        headerRow1: p1Row1,
        headerRow2: p1Row2,
        dataRows: makeRows(p1Row2.length)
      },
      {
        id: 2,
        sheetName: 'Proposition 2 - Advance',
        title: ESG_TITLE_BASE,
        headerRow1: p2Row1,
        headerRow2: p2Row2,
        dataRows: makeRows(p2Row2.length)
      },
      {
        id: 3,
        sheetName: 'Proposition 3 - Premium',
        title: ESG_TITLE_BASE,
        headerRow1: p3Row1,
        headerRow2: p3Row2,
        dataRows: makeRows(p3Row2.length)
      }
    ]
  }

  fs.writeFileSync(cmiJsonPath, JSON.stringify(cmiJson, null, 2), 'utf8')
  console.log(`✅ Updated CMI JSON: ${cmiJsonPath}`)
  if (prop1Headers) console.log(`   Used REAL Excel headers for ESG CMI tables`)
  else console.log(`   Used fallback ESG headers (Excel not found/parsed)`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
console.log('🚀 Starting ESG data transformation...')

// 1. Transform value.json
transformDataFile(
  path.join(DATA_DIR, 'value.json'),
  path.join(DATA_DIR, 'value.json')
)

// 2. Transform volume.json
transformDataFile(
  path.join(DATA_DIR, 'volume.json'),
  path.join(DATA_DIR, 'volume.json')
)

// 3. Update segmentation_analysis.json
updateSegmentationAnalysis()

// 4. Update CMI customer intelligence JSON
updateCmiJson()

console.log('\n✨ ESG data transformation complete!')
