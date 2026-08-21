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
 *   GET/PUT/DELETE /asset-meta… → curated overlay (status, notes, tags, comments, media)
 *   GET  /asset-image/:id       → 501
 *   GET  /system/health
 *
 * Supported assetType values: "tool" (Unity kind===tool), "equipment",
 * "interaction", "medication", "waveform", "scenario", "environment",
 * "authored-environment", "audio", "video".
 */

import cors from 'cors';
import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadUnityDbFromDir } from './load-unity-db.mjs';
import { createTagTaxonomyStore } from './tag-taxonomy.mjs';
import { createAssetMetaStore } from './asset-meta.mjs';
import { createAuthMiddleware } from './auth.mjs';
import {
  SUPPORTED_LIBRARY_TYPES,
  collectUniqueTags,
  listUnityAudio,
  listUnityVideos,
  listUnityAuthoredEnvironments,
  listUnityEnvironments,
  listUnityEquipment,
  listUnityInteractions,
  listUnityMedications,
  listUnityScenarios,
  listUnityTools,
  listUnityWaveforms,
  mapUnityAudioToLibraryAsset,
  mapUnityVideoToLibraryAsset,
  mapUnityAuthoredEnvironmentToLibraryAsset,
  mapUnityEnvironmentToLibraryAsset,
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
const environments = listUnityEnvironments(bundle);
const authoredEnvironments = listUnityAuthoredEnvironments(bundle);
const audio = listUnityAudio(bundle);
const videos = listUnityVideos(bundle);
/** All tool-catalog rows (tool/kit/group/vessel) for interaction FK resolution. */
const toolCatalog = (bundle.tools ?? []).filter((t) => t?.id);
console.log(
  `Loaded ${tools.length} tools (kind=tool|vessel), ${equipment.length} equipment, ${interactions.length} interactions, ${medications.length} medications, ${waveforms.length} waveforms, ${scenarios.length} scenarios, ${environments.length} environments, ${authoredEnvironments.length} authored environments, ${audio.length} audio clips, ${videos.length} videos.`,
);
console.table(bundle.meta?.counts ?? {});

const tagStore = createTagTaxonomyStore(DB_DIR);
console.log(
  `Tag taxonomy: ${tagStore.listTags().length} tags, ${tagStore.listCategories().length} categories.`,
);

const metaStore = createAssetMetaStore(DB_DIR);
const auth = createAuthMiddleware();
console.log(
  `Asset meta: ${metaStore.listAll().length} records` +
    (auth.enabled ? ' (Auth0 JWT required on writes)' : ' (local writes open)'),
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
});

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
  '/db/meta',
  express.static(path.join(DB_DIR, 'meta'), {
    fallthrough: true,
    index: false,
  }),
);

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
      environments,
      authoredEnvironments,
      audio,
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

/* ── Curated asset meta overlay (db/meta/) ─────────────────────────── */

app.get('/asset-meta', (_req, res) => {
  res.json({
    records: metaStore.listAll(),
    aliases: metaStore.getAliases(),
  });
});

app.delete('/asset-meta', auth.requireAuth, (req, res) => {
  if (req.query.confirm !== 'all') {
    return res.status(400).json({
      message: 'Pass ?confirm=all to delete every curated overlay record.',
    });
  }
  try {
    res.json(metaStore.clearAll());
  } catch (e) {
    res.status(400).json({ message: e.message ?? 'Failed to clear asset meta.' });
  }
});

app.post('/asset-meta/clear-all', auth.requireAuth, (req, res) => {
  try {
    res.json(metaStore.clearAll());
  } catch (e) {
    res.status(400).json({ message: e.message ?? 'Failed to clear asset meta.' });
  }
});

app.get('/asset-meta/:assetId', (req, res) => {
  const record = metaStore.get(req.params.assetId);
  if (!record) {
    return res.status(404).json({ message: 'Asset meta not found.' });
  }
  res.json(record);
});

app.put('/asset-meta/:assetId', auth.requireAuth, (req, res) => {
  try {
    const author = auth.authorFromReq(req);
    const record = metaStore.upsert(req.params.assetId, req.body ?? {}, author);
    res.json(record);
  } catch (e) {
    res.status(400).json({ message: e.message ?? 'Failed to save asset meta.' });
  }
});

app.delete('/asset-meta/:assetId', auth.requireAuth, (req, res) => {
  try {
    const result = metaStore.remove(req.params.assetId);
    if (!result.deleted) {
      return res.status(404).json({ message: 'Asset meta not found.' });
    }
    res.json(result);
  } catch (e) {
    res.status(400).json({ message: e.message ?? 'Failed to clear asset meta.' });
  }
});

app.post('/asset-meta/:assetId/comments', auth.requireAuth, (req, res) => {
  try {
    const author = auth.authorFromReq(req);
    const record = metaStore.addComment(
      req.params.assetId,
      req.body ?? {},
      author,
    );
    res.status(201).json(record);
  } catch (e) {
    res.status(400).json({ message: e.message ?? 'Failed to add comment.' });
  }
});

app.post(
  '/asset-meta/:assetId/media',
  auth.requireAuth,
  upload.single('file'),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'file is required.' });
      }
      const author = auth.authorFromReq(req);
      const snapshot = {
        assetKey: req.body?.assetKey,
        type: req.body?.type,
        name: req.body?.name,
      };
      const result = metaStore.addMedia(
        req.params.assetId,
        req.file,
        snapshot,
        author,
      );
      res.status(201).json(result);
    } catch (e) {
      res.status(400).json({ message: e.message ?? 'Failed to upload media.' });
    }
  },
);

app.delete(
  '/asset-meta/:assetId/media/:mediaId',
  auth.requireAuth,
  (req, res) => {
    try {
      const author = auth.authorFromReq(req);
      const record = metaStore.deleteMedia(
        req.params.assetId,
        req.params.mediaId,
        author,
      );
      if (!record) {
        return res.status(404).json({ message: 'Asset meta not found.' });
      }
      res.json(record);
    } catch (e) {
      res.status(400).json({ message: e.message ?? 'Failed to delete media.' });
    }
  },
);

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
      ...environments.map((e) => mapUnityEnvironmentToLibraryAsset(e, mapOpts)),
      ...authoredEnvironments.map((e) =>
        mapUnityAuthoredEnvironmentToLibraryAsset(e, mapOpts),
      ),
      ...audio.map((a) => mapUnityAudioToLibraryAsset(a, mapOpts)),
      ...videos.map((v) => mapUnityVideoToLibraryAsset(v, mapOpts)),
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
    if (assetTypes.includes('environment')) {
      results.push(
        ...environments.map((e) =>
          mapUnityEnvironmentToLibraryAsset(e, mapOpts),
        ),
      );
    }
    if (assetTypes.includes('authored-environment')) {
      results.push(
        ...authoredEnvironments.map((e) =>
          mapUnityAuthoredEnvironmentToLibraryAsset(e, mapOpts),
        ),
      );
    }
    if (assetTypes.includes('audio')) {
      results.push(...audio.map((a) => mapUnityAudioToLibraryAsset(a, mapOpts)));
    }
    if (assetTypes.includes('video')) {
      results.push(...videos.map((v) => mapUnityVideoToLibraryAsset(v, mapOpts)));
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
