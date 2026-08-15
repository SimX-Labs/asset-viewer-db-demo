/**
 * Scrape scenario-creator case JSON files into scenarios.json
 * (camelCase catalog rows — summary metadata, not full case dumps).
 *
 * Usage:
 *   node scripts/import-scenarios-from-cases.mjs [cases-dir] [out-path]
 *
 * Defaults:
 *   cases-dir = C:/SimX/scenario-creator-cases/scenarios
 *   out-path  = <UNITY_ASSET_DB_DIR>/scenarios.json
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { resolveDbRoot } from './resolve-db-root.mjs';

const casesDir = resolve(
  process.argv[2] ?? 'C:/SimX/scenario-creator-cases/scenarios',
);
const outPath = resolve(
  process.argv[3] ?? join(resolveDbRoot(), 'scenarios.json'),
);

if (!existsSync(casesDir)) {
  console.error(`Cases folder not found: ${casesDir}`);
  process.exit(1);
}

/**
 * @param {unknown} value
 * @returns {object[]}
 */
function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function strOrNull(value) {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length ? t : null;
}

/**
 * Sentinel `model` values that are not character prefabs. `environment` marks a
 * voice-only NPC hosted by an environment prop (telephone, radio, interpreter
 * tablet) rather than a spawned character.
 */
const NON_CHARACTER_MODELS = new Set(['environment', 'none', 'null']);

/**
 * @param {string | null} model
 * @returns {boolean} true when the value names an actual character addressable
 */
function isCharacterModel(model) {
  if (!model) return false;
  // Authoring placeholders such as "[npc model name]".
  if (/^\[.*\]$/.test(model)) return false;
  return !NON_CHARACTER_MODELS.has(model.toLowerCase());
}

/**
 * @param {object} scenario
 * @param {string} file
 */
function convertScenario(scenario, file) {
  const scenarioId =
    strOrNull(scenario.scenarioId) ||
    strOrNull(scenario.scenarioCreatorId) ||
    file.replace(/\.json$/i, '');

  const patients = asArray(scenario.patients).map((p) => ({
    id: strOrNull(p?.id),
    name: strOrNull(p?.name),
    model: strOrNull(p?.model),
  }));

  const npcs = asArray(scenario.npcs).map((n) => ({
    id: strOrNull(n?.id),
    name: strOrNull(n?.name),
    model: strOrNull(n?.model),
  }));

  const environments = asArray(scenario.environments).map((e) => ({
    id: strOrNull(e?.id),
    name: strOrNull(e?.name),
    model: strOrNull(e?.model),
    settings: strOrNull(e?.settings),
  }));

  /** @type {Record<string, string[]>} */
  const bundlesByType = {};
  for (const b of asArray(scenario.assetBundles)) {
    const type = strOrNull(b?.type) || 'unknown';
    const value = strOrNull(b?.value);
    if (!value) continue;
    (bundlesByType[type] ??= []).push(value);
  }
  for (const type of Object.keys(bundlesByType)) {
    bundlesByType[type] = [...new Set(bundlesByType[type])].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  const characterModels = [
    ...new Set(
      [...patients, ...npcs].map((c) => c.model).filter(isCharacterModel),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const environmentModels = [
    ...new Set(
      environments
        .map((e) => e.model)
        .filter((m) => typeof m === 'string' && m.length > 0),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const name =
    strOrNull(scenario.name) || `Scenario ${scenarioId.slice(0, 8)}`;

  /** @type {string[]} */
  const tags = [];
  if (scenario.roleBased === true) tags.push('roleBased');
  for (const model of environmentModels) tags.push(model);

  return {
    id: scenarioId,
    type: 'scenario',
    name,
    scenarioCreatorId: strOrNull(scenario.scenarioCreatorId),
    author: strOrNull(scenario.author) || strOrNull(scenario.createdBy),
    createdBy: strOrNull(scenario.createdBy),
    createdAt: strOrNull(scenario.createdAt),
    description: strOrNull(scenario.description),
    learnerDescription: strOrNull(scenario.learnerDescription),
    roleBased: scenario.roleBased === true,
    startingState:
      strOrNull(scenario.startingState) ||
      strOrNull(scenario.startingScenarioStateId),
    thumbnail: strOrNull(scenario.thumbnail),
    sourceFile: file,
    counts: {
      patients: patients.length,
      npcs: npcs.length,
      states: asArray(scenario.states).length,
      actions: asArray(scenario.actions).length,
      actionGroups: asArray(scenario.actionGroups).length,
      waveforms: asArray(scenario.waveforms).length,
      environments: environments.length,
      assetBundles: asArray(scenario.assetBundles).length,
    },
    patients,
    npcs,
    environments,
    characterModels,
    environmentModels,
    assetBundlesByType: bundlesByType,
    tags,
  };
}

const scenarios = [];
let skipped = 0;

for (const file of readdirSync(casesDir).filter((f) =>
  f.toLowerCase().endsWith('.json'),
)) {
  let scenario;
  try {
    scenario = JSON.parse(readFileSync(join(casesDir, file), 'utf8'));
  } catch {
    skipped++;
    continue;
  }
  if (!scenario || typeof scenario !== 'object') {
    skipped++;
    continue;
  }
  scenarios.push(convertScenario(scenario, file));
}

scenarios.sort((a, b) =>
  String(a.name).localeCompare(String(b.name), undefined, {
    sensitivity: 'base',
  }),
);

writeFileSync(outPath, JSON.stringify(scenarios, null, 2) + '\n');
console.log(
  `Read ${scenarios.length + skipped} case files (${skipped} skipped). Wrote ${scenarios.length} scenarios → ${outPath}`,
);
