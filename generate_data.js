const fs = require('fs');
const path = require('path');

/**
 * Synthetic park lock actuator market data aligned with dashboard segment taxonomies:
 * - By Actuation Technology
 * - By Motion Output Type
 * - By Transmission and Driveline Application
 * - By Vehicle Type
 * - By Sales Channel
 * Geography keys mirror segmentation_analysis (regions, countries, By Country).
 */

const years = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

const regions = {
  'North America': ['U.S.', 'Canada'],
  Europe: ['U.K.', 'Germany', 'Italy', 'France', 'Spain', 'Russia', 'Rest of Europe'],
  'Asia Pacific': ['China', 'India', 'Japan', 'South Korea', 'ASEAN', 'Australia', 'Rest of Asia Pacific'],
  'Latin America': ['Brazil', 'Argentina', 'Mexico', 'Rest of Latin America'],
  'Middle East & Africa': ['GCC', 'South Africa', 'Rest of Middle East & Africa'],
};

const regionBaseValues = {
  'North America': 18500,
  Europe: 14200,
  'Asia Pacific': 9800,
  'Latin America': 4100,
  'Middle East & Africa': 3600,
};

const countryShares = {
  'North America': { 'U.S.': 0.82, Canada: 0.18 },
  Europe: { 'U.K.': 0.18, Germany: 0.22, Italy: 0.12, France: 0.16, Spain: 0.1, Russia: 0.08, 'Rest of Europe': 0.14 },
  'Asia Pacific': { China: 0.28, India: 0.12, Japan: 0.25, 'South Korea': 0.12, ASEAN: 0.1, Australia: 0.07, 'Rest of Asia Pacific': 0.06 },
  'Latin America': { Brazil: 0.45, Argentina: 0.15, Mexico: 0.25, 'Rest of Latin America': 0.15 },
  'Middle East & Africa': { GCC: 0.45, 'South Africa': 0.25, 'Rest of Middle East & Africa': 0.3 },
};

const regionGrowthRates = {
  'North America': 0.092,
  Europe: 0.085,
  'Asia Pacific': 0.112,
  'Latin America': 0.095,
  'Middle East & Africa': 0.09,
};

/** Weighted trees: only leaves are positive numbers; objects group siblings. */
const segmentTrees = {
  'By Actuation Technology': {
    'Electromechanical Park Lock Actuators': 1.1,
    'Electrohydraulic Park Lock Actuators': 1,
  },
  'By Motion Output Type': {
    'Rotary Output Park Lock Actuators': 1.05,
    'Linear Output Park Lock Actuators': 1,
  },
  'By Transmission and Driveline Application': {
    'Torque Converter Automatic Transmission Park Lock Actuators': 1.15,
    'Dual-Clutch Transmission Park Lock Actuators': 1.1,
    'Electric Drive Unit and E-Axle Park Lock Actuators': 1.25,
    'Automated Manual Transmission Park Lock Actuators': 0.95,
    'Others (Dedicated Hybrid Transmission Park Lock Actuators, Continuously Variable Transmission Park Lock Actuators, etc.)': 0.9,
  },
  'By Vehicle Type': {
    'Passenger Cars': 1.2,
    'Commercial Vehicles': {
      'Light Commercial Vehicles': 1,
      'Medium and Heavy Commercial Vehicles': 1.15,
    },
    'Off-Highway Vehicles': 0.85,
  },
  'By Sales Channel': {
    'OEM Fitment': 1.2,
    'Aftermarket Replacement': 1,
  },
};

let seed = 42;
function seededRandom() {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}

function addNoise(value, noiseLevel = 0.03) {
  return value * (1 + (seededRandom() - 0.5) * 2 * noiseLevel);
}

function roundTo1(val) {
  return Math.round(val * 10) / 10;
}

function roundToInt(val) {
  return Math.round(val);
}

function generateTimeSeries(baseValue, growthRate, roundFn) {
  const series = {};
  for (let i = 0; i < years.length; i++) {
    const year = years[i];
    const rawValue = baseValue * Math.pow(1 + growthRate, i);
    series[year] = roundFn(addNoise(rawValue));
  }
  return series;
}

function sumLeafWeights(node) {
  if (typeof node === 'number') return node;
  if (typeof node !== 'object' || node === null) return 0;
  return Object.values(node).reduce((s, v) => s + sumLeafWeights(v), 0);
}

/** Returns [{ path: string[], weight }] weights sum to 1 within this subtree */
function flattenWeightedTree(node, prefix = []) {
  if (typeof node === 'number') {
    return [{ path: prefix, weight: 1 }];
  }
  const entries = Object.entries(node);
  const masses = {};
  let total = 0;
  for (const [k, v] of entries) {
    const m = typeof v === 'number' ? v : sumLeafWeights(v);
    masses[k] = m;
    total += m;
  }
  const out = [];
  for (const [k, v] of entries) {
    const share = masses[k] / total;
    if (typeof v === 'number') {
      out.push({ path: [...prefix, k], weight: share });
    } else {
      const inner = flattenWeightedTree(v, [...prefix, k]);
      inner.forEach(({ path, weight }) => {
        out.push({ path, weight: weight * share });
      });
    }
  }
  const sumW = out.reduce((s, x) => s + x.weight, 0);
  return out.map((x) => ({ path: x.path, weight: x.weight / sumW }));
}

function emptyStructureFromTree(node) {
  if (typeof node === 'number') return {};
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] = emptyStructureFromTree(v);
  }
  return out;
}

function setDeep(obj, path, leafValue) {
  let cur = obj;
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    if (i === path.length - 1) {
      cur[key] = leafValue;
    } else {
      if (!cur[key] || typeof cur[key] !== 'object') cur[key] = {};
      cur = cur[key];
    }
  }
}

/** Slight growth variation by geography / path string */
function defaultGrowthKey(pathKey) {
  const h = Math.abs(String(pathKey).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 7;
  return 0.92 + h * 0.02;
}

function buildSegmentPayloadForGeo(regionBase, regionGrowth, countryGrowth, isVolume, pathKey) {
  const roundFn = isVolume ? roundToInt : roundTo1;
  const multiplier = isVolume ? 42 : 1;
  const base = regionBase * multiplier;
  const growth = regionGrowth * defaultGrowthKey(pathKey);

  const leavesByType = {};
  for (const [segType, tree] of Object.entries(segmentTrees)) {
    leavesByType[segType] = flattenWeightedTree(tree);
  }

  const out = {};
  for (const [segType, leaves] of Object.entries(leavesByType)) {
    out[segType] = {};
    const noise = 1 + (seededRandom() - 0.5) * 0.08;
    for (const { path, weight } of leaves) {
      const leafBase = base * weight * noise;
      const series = generateTimeSeries(leafBase, growth * countryGrowth, roundFn);
      setDeep(out[segType], path, series);
    }
  }

  return out;
}

function buildGlobalSegmentation() {
  const inner = {};
  for (const [segType, tree] of Object.entries(segmentTrees)) {
    inner[segType] = emptyStructureFromTree(tree);
  }
  const byRegion = {};
  for (const regionName of Object.keys(regions)) {
    byRegion[regionName] = {};
    for (const c of regions[regionName]) {
      byRegion[regionName][c] = {};
    }
  }
  inner['By Region'] = byRegion;
  return { Global: inner };
}

function buildAllGeographyData(isVolume) {
  const data = {};
  const roundFn = isVolume ? roundToInt : roundTo1;
  let s = isVolume ? 9001 : 42;

  for (const [regionName, countries] of Object.entries(regions)) {
    seed = s;
    s += 97;
    const regionBase = regionBaseValues[regionName];
    const regionGrowth = regionGrowthRates[regionName];

    const regionBlock = buildSegmentPayloadForGeo(regionBase, regionGrowth, 1, isVolume, regionName);

    regionBlock['By Country'] = {};
    for (const country of countries) {
      const cShare = countryShares[regionName][country];
      const countryBase = regionBase * cShare;
      const countryGrowthVar = 1 + (seededRandom() - 0.5) * 0.04;
      regionBlock['By Country'][country] = generateTimeSeries(
        countryBase,
        regionGrowth * countryGrowthVar,
        roundFn
      );
    }

    data[regionName] = regionBlock;

    for (const country of countries) {
      if (data[country]) continue;
      seed = s + country.charCodeAt(0);
      const cShare = countryShares[regionName][country];
      const countryBase = regionBase * cShare;
      const countryGrowthVar = 1 + (seededRandom() - 0.5) * 0.04;
      data[country] = buildSegmentPayloadForGeo(
        countryBase,
        regionGrowth,
        countryGrowthVar,
        isVolume,
        country
      );
    }
  }

  return data;
}

const segmentation = buildGlobalSegmentation();
seed = 42;
const valueData = buildAllGeographyData(false);
seed = 9001;
const volumeData = buildAllGeographyData(true);

const outDir = path.join(__dirname, 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'value.json'), JSON.stringify(valueData, null, 2));
fs.writeFileSync(path.join(outDir, 'volume.json'), JSON.stringify(volumeData, null, 2));
fs.writeFileSync(path.join(outDir, 'segmentation_analysis.json'), JSON.stringify(segmentation, null, 2));

console.log('Generated value.json, volume.json, segmentation_analysis.json');
console.log('Segment types:', Object.keys(valueData['North America']).filter((k) => k !== 'By Country'));
