/**
 * Load the Unity asset DB from a per-file folder (same layout as
 * unity-asset-documentation/db).
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {string} dbRoot absolute path to the db folder
 */
export function loadUnityDbFromDir(dbRoot) {
  if (!fs.existsSync(dbRoot)) {
    throw new Error(`Unity asset DB folder not found: ${dbRoot}`);
  }

  const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const readDir = (sub) => {
    const dir = path.join(dbRoot, sub);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.json'))
      .map((f) => {
        try {
          return readJson(path.join(dir, f));
        } catch (e) {
          console.warn(`  ! skipped ${sub}/${f}: ${e.message}`);
          return null;
        }
      })
      .filter(Boolean);
  };

  const readArray = (file) => {
    const filePath = path.join(dbRoot, file);
    if (!fs.existsSync(filePath)) return [];
    const data = readJson(filePath);
    return Array.isArray(data) ? data : [];
  };

  const bundle = {
    meta: {
      source: dbRoot,
      generatedAt: new Date().toISOString(),
    },
    characters: readDir('characters'),
    equipment: readDir('equipment'),
    tools: readDir('tools'),
    interactions: readDir('interactions'),
    environments: readDir('environments'),
    authoredEnvironments: readDir('authored-environments'),
    audio: readDir('audio'),
    videos: readDir('videos'),
    clothing: readArray('clothing.json'),
    medications: readArray('medications.json'),
    waveforms: readArray('waveforms.json'),
    scenarios: readArray('scenarios.json'),
    characterMetadata: readArray('character-metadata.json'),
    toolMetadata: readArray('tool-metadata.json'),
  };

  bundle.meta.counts = {
    characters: bundle.characters.length,
    equipment: bundle.equipment.length,
    tools: bundle.tools.length,
    interactions: bundle.interactions.length,
    environments: bundle.environments.length,
    authoredEnvironments: bundle.authoredEnvironments.length,
    audio: bundle.audio.length,
    videos: bundle.videos.length,
    clothing: bundle.clothing.length,
    medications: bundle.medications.length,
    waveforms: bundle.waveforms.length,
    scenarios: bundle.scenarios.length,
    characterMetadata: bundle.characterMetadata.length,
    toolMetadata: bundle.toolMetadata.length,
  };

  return bundle;
}
