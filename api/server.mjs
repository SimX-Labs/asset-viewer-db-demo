/**
 * Asset Database PoC API — Library-compatible HTTP surface over the Unity
 * asset DB folder (UNITY_ASSET_DB_DIR, else unity-asset-documentation/db).
 *
 * Endpoints (mirrors Asset Library contract used by scenario-creator):
 *   POST /assets
 *   GET  /tags                  → curated taxonomy tags (legacy shape)
 *   POST/PATCH/DELETE /tags…
 *   GET  /tag-categories        → curated categories
 *   POST/PATCH/DELETE /tag-categories…
 *   GET/PUT /tag-taxonomy       → full taxonomy file
 *   GET  /asset-image/:id       → 501
 *   GET  /system/health
 *
 * Supported assetType values: "tool" (Unity kind===tool), "equipment",
 * "interaction", "medication", "waveform", "scenario".
 */

import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadUnityDbFromDir } from './load-unity-db.mjs';
import { createTagTaxonomyStore } from './tag-taxonomy.mjs';
import {
  SUPPORTED_LIBRARY_TYPES,
  collectUniqueTags,
  listUnityEquipment,
  listUnityInteractions,
  listUnityMedications,
  listUnityScenarios,
  listUnityTools,
  listUnityWaveforms,
  mapUnityEquipmentToLibraryAsset,
  mapUnityInteractionToLibraryAsset,
  mapUnityMedicationToLibraryAsset,
  mapUnityScenarioToLibraryAsset,
  mapUnityToolToLibraryAsset,
  mapUnityWaveformToLibraryAsset,
  unsupportedTypeMessage,
} from './unity-mapper.mjs';
import {
  DEFAULT_UNITY_ASSET_DB_DIR,
  resolveDbRoot,
} from '../scripts/resolve-db-root.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4301);
const DB_DIR = resolveDbRoot();
if (!process.env.UNITY_ASSET_DB_DIR) {
  console.log(
    `UNITY_ASSET_DB_DIR unset; using default ${DEFAULT_UNITY_ASSET_DB_DIR}`,
  );
}
/**
 * Orbit Capture exports: one subfolder per addressable key, each holding
 * manifest.json + model.glb. Served over HTTP so embedded viewers (iframes)
 * can render models without the File System Access API.
 */
const ORBIT_DIR =
  process.env.ORBIT_CAPTURES_DIR || path.resolve(__dirname, '../public/models');

console.log(`Loading Unity asset DB from ${DB_DIR}…`);
const bundle = loadUnityDbFromDir(DB_DIR);
const tools = listUnityTools(bundle);
const equipment = listUnityEquipment(bundle);
const interactions = listUnityInteractions(bundle);
const medications = listUnityMedications(bundle);
const waveforms = listUnityWaveforms(bundle);
const scenarios = listUnityScenarios(bundle);
/** All tool-catalog rows (tool/kit/group/vessel) for interaction FK resolution. */
const toolCatalog = (bundle.tools ?? []).filter((t) => t?.id);
console.log(
  `Loaded ${tools.length} tools (kind=tool), ${equipment.length} equipment, ${interactions.length} interactions, ${medications.length} medications, ${waveforms.length} waveforms, ${scenarios.length} scenarios.`,
);
console.table(bundle.meta?.counts ?? {});

const tagStore = createTagTaxonomyStore(DB_DIR);
console.log(
  `Tag taxonomy: ${tagStore.listTags().length} tags, ${tagStore.listCategories().length} categories.`,
);

/**
 * @param {string} dir
 * @returns {string[]} capture subfolder names that contain a manifest.json
 */
function listOrbitCaptureKeys(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          fs.existsSync(path.join(dir, entry.name, 'manifest.json')),
      )
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/system/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const orbitKeys = listOrbitCaptureKeys(ORBIT_DIR);
console.log(
  orbitKeys.length
    ? `Serving ${orbitKeys.length} orbit captures from ${ORBIT_DIR} at /models`
    : `No orbit captures found at ${ORBIT_DIR} (set ORBIT_CAPTURES_DIR).`,
);

/** Available capture keys, so clients can tell "no model" from "not configured". */
app.get('/models-index', (_req, res) => {
  res.json({ count: orbitKeys.length, keys: orbitKeys });
});

app.use(
  '/models',
  express.static(ORBIT_DIR, {
    fallthrough: false,
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.toLowerCase().endsWith('.glb')) {
        res.setHeader('Content-Type', 'model/gltf-binary');
      }
    },
  }),
);

app.get('/tags', (_req, res) => {
  // Prefer curated taxonomy (legacy Asset Library shape). Fall back to
  // asset-derived label strings when the taxonomy is empty.
  const curated = tagStore.listTags();
  if (curated.length > 0) {
    return res.json(curated);
  }
  res.json(
    collectUniqueTags(
      tools,
      equipment,
      interactions,
      medications,
      waveforms,
      scenarios,
    ),
  );
});

app.post('/tags', (req, res) => {
  const created = tagStore.createTag(req.body ?? {});
  res.status(201).json(created);
});

app.get('/tags/:dataId', (req, res) => {
  const tag = tagStore.listTags().find((t) => t.dataId === req.params.dataId);
  if (!tag) return res.status(404).json({ message: 'Tag not found.' });
  res.json(tag);
});

app.patch('/tags/:dataId', (req, res) => {
  const updated = tagStore.updateTag(req.params.dataId, req.body ?? {});
  if (!updated) return res.status(404).json({ message: 'Tag not found.' });
  res.json(updated);
});

app.delete('/tags/:dataId', (req, res) => {
  if (!tagStore.deleteTag(req.params.dataId)) {
    return res.status(404).json({ message: 'Tag not found.' });
  }
  res.status(200).send();
});

app.get('/tag-categories', (_req, res) => {
  res.json(tagStore.listCategories());
});

app.post('/tag-categories', (req, res) => {
  const created = tagStore.createCategory(req.body ?? {});
  res.status(201).json(created);
});

app.get('/tag-categories/:dataId', (req, res) => {
  const category = tagStore
    .listCategories()
    .find((c) => c.dataId === req.params.dataId);
  if (!category) {
    return res.status(404).json({ message: 'Tag category not found.' });
  }
  res.json(category);
});

app.patch('/tag-categories/:dataId', (req, res) => {
  const updated = tagStore.updateCategory(req.params.dataId, req.body ?? {});
  if (!updated) {
    return res.status(404).json({ message: 'Tag category not found.' });
  }
  res.json(updated);
});

app.delete('/tag-categories/:dataId', (req, res) => {
  if (!tagStore.deleteCategory(req.params.dataId)) {
    return res.status(404).json({ message: 'Tag category not found.' });
  }
  res.status(200).send();
});

app.get('/tag-taxonomy', (_req, res) => {
  res.json(tagStore.getTaxonomy());
});

app.put('/tag-taxonomy', (req, res) => {
  res.json(tagStore.replaceTaxonomy(req.body ?? {}));
});

app.get('/asset-image/:id', (_req, res) => {
  res.status(501).json({
    message:
      'Asset Database does not yet serve asset images (no image store on the Unity export).',
  });
});

/**
 * Library-compatible asset query.
 * Body fields used by scenario-creator today: assetType, dataId, returnType, images,
 * searchColumn, searchValue, assetId.
 */
app.post('/assets', (req, res) => {
  const body = req.body ?? {};
  const assetTypes = Array.isArray(body.assetType)
    ? body.assetType
    : body.assetType
      ? [body.assetType]
      : [];

  if (!body.dataId && !body.assetId && assetTypes.length === 0) {
    return res.status(400).json({
      message: 'POST /assets requires assetType, dataId, or assetId.',
    });
  }

  if (assetTypes.length > 0) {
    const unsupported = assetTypes.filter(
      (t) => !SUPPORTED_LIBRARY_TYPES.includes(t),
    );
    if (unsupported.length > 0) {
      return res.status(501).json({
        message: unsupportedTypeMessage(unsupported[0]),
      });
    }
  }

  const includeData = body.returnType !== 'basic';
  const includeImages = !!body.images;
  const interactionById = new Map(
    interactions.filter((i) => i?.id).map((i) => [i.id, i]),
  );
  const interactionByLocation = new Map(
    interactions
      .filter((i) => i?.location)
      .map((i) => [i.location, i]),
  );
  const toolById = new Map(toolCatalog.map((t) => [t.id, t]));
  const equipmentById = new Map(
    equipment.filter((e) => e?.id).map((e) => [e.id, e]),
  );
  const mapOpts = {
    includeData,
    includeImages,
    interactionById,
    interactionByLocation,
    toolById,
    equipmentById,
  };

  /** @type {object[]} */
  let results = [];

  // Id-only lookup searches all catalogs; typed queries stay scoped.
  if (body.dataId || body.assetId) {
    results = [
      ...tools.map((t) => mapUnityToolToLibraryAsset(t, mapOpts)),
      ...equipment.map((e) => mapUnityEquipmentToLibraryAsset(e, mapOpts)),
      ...interactions.map((i) => mapUnityInteractionToLibraryAsset(i, mapOpts)),
      ...medications.map((m) => mapUnityMedicationToLibraryAsset(m, mapOpts)),
      ...waveforms.map((w) => mapUnityWaveformToLibraryAsset(w, mapOpts)),
      ...scenarios.map((s) => mapUnityScenarioToLibraryAsset(s, mapOpts)),
    ];
  } else {
    if (assetTypes.includes('tool')) {
      results.push(...tools.map((t) => mapUnityToolToLibraryAsset(t, mapOpts)));
    }
    if (assetTypes.includes('equipment')) {
      results.push(
        ...equipment.map((e) => mapUnityEquipmentToLibraryAsset(e, mapOpts)),
      );
    }
    if (assetTypes.includes('interaction')) {
      results.push(
        ...interactions.map((i) =>
          mapUnityInteractionToLibraryAsset(i, mapOpts),
        ),
      );
    }
    if (assetTypes.includes('medication')) {
      results.push(
        ...medications.map((m) => mapUnityMedicationToLibraryAsset(m, mapOpts)),
      );
    }
    if (assetTypes.includes('waveform')) {
      results.push(
        ...waveforms.map((w) => mapUnityWaveformToLibraryAsset(w, mapOpts)),
      );
    }
    if (assetTypes.includes('scenario')) {
      results.push(
        ...scenarios.map((s) => mapUnityScenarioToLibraryAsset(s, mapOpts)),
      );
    }
  }

  if (body.dataId) {
    results = results.filter((a) => a.dataId === body.dataId);
  } else if (body.assetId) {
    results = results.filter((a) => a.assetId === body.assetId);
  }

  if (
    body.searchColumn &&
    body.searchValue != null &&
    body.searchValue !== ''
  ) {
    const col = body.searchColumn;
    const needle = String(body.searchValue).toLowerCase();
    const allowed = new Set([
      'assetId',
      'assetName',
      'dataId',
      'description',
      'prefabName',
      'tags',
    ]);
    if (allowed.has(col)) {
      results = results.filter((a) => {
        if (col === 'tags') {
          const tags = Array.isArray(a.tags) ? a.tags : [];
          return tags.some((t) => String(t).toLowerCase().includes(needle));
        }
        return String(a[col] ?? '')
          .toLowerCase()
          .includes(needle);
      });
    }
  }

  res.json(results);
});

app.listen(PORT, () => {
  console.log(`Asset Database API listening on http://localhost:${PORT}`);
});
