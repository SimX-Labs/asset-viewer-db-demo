/**
 * Scrape waveform libraries from scenario-creator case JSON files and write
 * waveforms.json (camelCase catalog rows).
 *
 * Usage:
 *   node scripts/import-waveforms-from-cases.mjs [cases-dir] [out-path]
 *
 * Defaults:
 *   cases-dir = C:/SimX/scenario-creator-cases/scenarios
 *   out-path  = <UNITY_ASSET_DB_DIR>/waveforms.json
 *
 * Dedupes by content fingerprint (name + dataPoints + waveCount). Case-instance
 * ids with identical traces are merged under one canonical id; alternate ids
 * and all referencing scenarios are retained. Distinct point arrays stay
 * separate assets even if names match. Maps scenario `value[]` → `dataPoints`.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolveDbRoot } from './resolve-db-root.mjs';

const casesDir = resolve(
  process.argv[2] ?? 'C:/SimX/scenario-creator-cases/scenarios',
);
const outPath = resolve(
  process.argv[3] ?? join(resolveDbRoot(), 'waveforms.json'),
);

if (!existsSync(casesDir)) {
  console.error(`Cases folder not found: ${casesDir}`);
  process.exit(1);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {string} name
 * @returns {{ maxHr: number | null, maxRr: number | null, waveCountHint: number | null, waveformType: string | null }}
 */
function inferFromName(name) {
  const n = String(name ?? '');
  const hr = n.match(/Max\s*HR\s*[=:]?\s*(\d+)/i);
  const rr = n.match(/Max\s*RR\s*[=:]?\s*(\d+)/i);
  const wc = n.match(/wave\s*count\s*[=:]?\s*(\d+)/i);

  /** @type {string | null} */
  let waveformType = null;
  const lower = n.toLowerCase();
  if (
    /\becg\b|sinus|nsr|svt|vtach|v\s*tach|vfib|v\s*fib|afib|bradycardia|hyperkalemia|pvc|alternans|cpr artifact/i.test(
      n,
    )
  ) {
    waveformType = 'ECG';
  } else if (/pleth/i.test(n)) {
    waveformType = 'PLETH';
  } else if (/resp/i.test(n)) {
    waveformType = 'RESP';
  } else if (/\biap\b/i.test(n)) {
    waveformType = 'IAP';
  } else if (/etco2/i.test(n)) {
    waveformType = 'EtCO2';
  } else if (
    /vent\s*\d|ventilator|flowrate|pressure - anesthesia|volume/i.test(lower)
  ) {
    waveformType = 'VENT';
  } else if (/flatline/i.test(n)) {
    waveformType = 'Flatline';
  }

  return {
    maxHr: hr ? Number(hr[1]) : null,
    maxRr: rr ? Number(rr[1]) : null,
    waveCountHint: wc ? Number(wc[1]) : null,
    waveformType,
  };
}

/**
 * @param {unknown} value
 * @returns {number[]}
 */
function toDataPoints(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const v of value) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * Content key: same name + same samples + same waveCount ⇒ one catalog asset.
 * @param {string} name
 * @param {number[]} dataPoints
 * @param {number} waveCount
 */
function contentKey(name, dataPoints, waveCount) {
  return `${name}\n${waveCount}\n${dataPoints.join(',')}`;
}

/**
 * Prefer a stable UUID over short scenario-creator local ids.
 * @param {string} current
 * @param {string} candidate
 */
function preferId(current, candidate) {
  const curUuid = UUID_RE.test(current);
  const candUuid = UUID_RE.test(candidate);
  if (candUuid && !curUuid) return candidate;
  if (curUuid && !candUuid) return current;
  // Both same class: keep lexicographically smaller for stability.
  return candidate < current ? candidate : current;
}

/**
 * @param {string[]} list
 * @param {string} value
 */
function pushUnique(list, value) {
  if (value && !list.includes(value)) list.push(value);
}

/** @type {Map<string, object>} */
const byContent = new Map();
let filesRead = 0;
let skipped = 0;
let rawInstances = 0;

for (const file of readdirSync(casesDir).filter((f) =>
  f.toLowerCase().endsWith('.json'),
)) {
  const filePath = join(casesDir, file);
  let scenario;
  try {
    scenario = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    skipped++;
    continue;
  }
  filesRead++;

  const scenarioId =
    (typeof scenario.scenarioId === 'string' && scenario.scenarioId) ||
    (typeof scenario.scenarioCreatorId === 'string' &&
      scenario.scenarioCreatorId) ||
    file.replace(/\.json$/i, '');
  const scenarioName =
    (typeof scenario.name === 'string' && scenario.name) || scenarioId;

  const list = Array.isArray(scenario.waveforms) ? scenario.waveforms : [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const id = typeof raw.id === 'string' ? raw.id : null;
    if (!id) continue;
    rawInstances++;

    const dataPoints = toDataPoints(raw.value);
    const name =
      (typeof raw.name === 'string' && raw.name.trim()) ||
      `Waveform ${id.slice(0, 8)}`;
    const inferred = inferFromName(name);
    const waveCount =
      typeof raw.waveCount === 'number' && Number.isFinite(raw.waveCount)
        ? raw.waveCount
        : (inferred.waveCountHint ?? 1);

    const key = contentKey(name, dataPoints, waveCount);
    const existing = byContent.get(key);

    if (existing) {
      pushUnique(existing.scenarioIds, scenarioId);
      pushUnique(existing.scenarioNames, scenarioName);
      if (id !== existing.id) pushUnique(existing.alternateIds, id);
      const better = preferId(existing.id, id);
      if (better !== existing.id) {
        pushUnique(existing.alternateIds, existing.id);
        existing.alternateIds = existing.alternateIds.filter((x) => x !== better);
        existing.id = better;
      }
      continue;
    }

    /** @type {string[]} */
    const tags = [];
    if (inferred.waveformType) tags.push(inferred.waveformType);

    byContent.set(key, {
      id,
      type: 'waveform',
      name,
      dataPoints,
      waveCount,
      description: null,
      maxHr: inferred.maxHr,
      maxRr: inferred.maxRr,
      pacer: null,
      pvcs: null,
      waveformType: inferred.waveformType,
      alternateIds: [],
      scenarioIds: [scenarioId],
      scenarioNames: [scenarioName],
      tags,
    });
  }
}

const waveforms = [...byContent.values()]
  .map((w) => {
    w.alternateIds.sort((a, b) => a.localeCompare(b));
    w.scenarioIds.sort((a, b) => a.localeCompare(b));
    w.scenarioNames.sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
    return w;
  })
  .sort((a, b) =>
    String(a.name).localeCompare(String(b.name), undefined, {
      sensitivity: 'base',
    }),
  );

writeFileSync(outPath, JSON.stringify(waveforms, null, 2) + '\n');
console.log(
  `Read ${filesRead} case files (${skipped} skipped). ${rawInstances} case-instance waveforms → ${waveforms.length} consolidated → ${outPath}`,
);
