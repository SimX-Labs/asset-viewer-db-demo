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
 *   GET  /unity-client/*        → albedo files from UNITY_CLIENT_ROOT (Assets/ only)
 *   GET  /models-index          → published orbit capture keys
 *   GET/PUT /models-root        → current orbit folder; remount with { dir }
 *   GET  /system/health
 *
 * Supported assetType values: "tool" (Unity kind===tool), "equipment",
 * "interaction", "character", "medication", "waveform", "scenario", "environment",
 * "authored-environment", "audio", "video".
 */

import cors from 'cors';
import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
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
  listUnityCharacters,
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
  mapUnityCharacterToLibraryAsset,
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
  DEFAULT_UNITY_CLIENT_ROOT,
  FALLBACK_ORBIT_CAPTURES_DIR,
  orbitCaptureSuggestions,
  resolveDbRoot,
  resolveOrbitCapturesDir,
  resolveUnityClientRoot,
} from '../scripts/resolve-db-root.mjs';

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
 *
 * Default prefers the sibling unity-env-authoring EXPORT when it exists;
 * public/models is an older copy that is missing newer client captures.
 * PUT /models-root remounts for this process.
 */
let orbitDir = resolveOrbitCapturesDir();
if (!process.env.ORBIT_CAPTURES_DIR) {
  console.log(`ORBIT_CAPTURES_DIR unset; using ${orbitDir}`);
}
/**
 * Unity client checkout. BodyTexture / OverlayTexture previews resolve
 * texturePath against this tree (no copies under db/).
 */
const UNITY_CLIENT_ROOT = resolveUnityClientRoot();
if (!process.env.UNITY_CLIENT_ROOT) {
  console.log(
    `UNITY_CLIENT_ROOT unset; using default ${DEFAULT_UNITY_CLIENT_ROOT}`,
  );
}

console.log(`Loading Unity asset DB from ${DB_DIR}…`);
const bundle = loadUnityDbFromDir(DB_DIR);
const tools = listUnityTools(bundle);
const equipment = listUnityEquipment(bundle);
const characters = listUnityCharacters(bundle);
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
  `Loaded ${tools.length} tools (kind=tool|vessel), ${equipment.length} equipment, ${characters.length} characters, ${interactions.length} interactions, ${medications.length} medications, ${waveforms.length} waveforms, ${scenarios.length} scenarios, ${environments.length} environments, ${authoredEnvironments.length} authored environments, ${audio.length} audio clips, ${videos.length} videos.`,
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

/** @param {string} dir */
function countSubdirectories(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory()).length;
  } catch {
    return 0;
  }
}

/** @param {string} a @param {string} b */
function sameFsPath(a, b) {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

function createModelsStatic(dir) {
  return express.static(dir, {
    fallthrough: false,
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.toLowerCase().endsWith('.glb')) {
        res.setHeader('Content-Type', 'model/gltf-binary');
      }
    },
  });
}

function describeOrbitRoot() {
  const suggestions = orbitCaptureSuggestions().map((s) => {
    let exists = false;
    try {
      exists = fs.existsSync(s.dir) && fs.statSync(s.dir).isDirectory();
    } catch {
      exists = false;
    }
    return {
      ...s,
      exists,
      count: exists ? countSubdirectories(s.dir) : 0,
      current: sameFsPath(s.dir, orbitDir),
    };
  });
  const usingStaleCopy = sameFsPath(orbitDir, FALLBACK_ORBIT_CAPTURES_DIR);
  const exportSuggestion = suggestions.find((s) => s.id === 'export');
  return {
    dir: orbitDir,
    count: orbitKeys.length,
    usingStaleCopy,
    staleHint:
      usingStaleCopy && exportSuggestion?.exists
        ? 'This is a stale copy in the viewer repo. Tools were copied here; newer character / body / overlay captures live in the Unity env-authoring export.'
        : null,
    suggestions,
  };
}

/** @param {string} dir */
function applyOrbitDir(dir) {
  orbitDir = path.resolve(dir);
  orbitKeys = listOrbitCaptureKeys(orbitDir);
  serveModels = createModelsStatic(orbitDir);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/system/health', (_req, res) => {
  res.json({ status: 'ok' });
});

let orbitKeys = listOrbitCaptureKeys(orbitDir);
let serveModels = createModelsStatic(orbitDir);
console.log(
  orbitKeys.length
    ? `Serving ${orbitKeys.length} orbit captures from ${orbitDir} at /models`
    : `No orbit captures found at ${orbitDir} (set ORBIT_CAPTURES_DIR or use PUT /models-root).`,
);

/** Available capture keys, so clients can tell "no model" from "not configured". */
app.get('/models-index', (_req, res) => {
  res.json({ count: orbitKeys.length, keys: orbitKeys, dir: orbitDir });
});

app.get('/models-root', (_req, res) => {
  res.json(describeOrbitRoot());
});

app.put('/models-root', auth.requireAuth, (req, res) => {
  const dir = typeof req.body?.dir === 'string' ? req.body.dir.trim() : '';
  if (!dir) {
    return res.status(400).json({ message: 'dir is required.' });
  }
  const resolved = path.resolve(dir);
  try {
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return res.status(400).json({ message: `Not a directory: ${resolved}` });
    }
  } catch (e) {
    return res.status(400).json({ message: e.message ?? `Cannot read ${resolved}` });
  }
  applyOrbitDir(resolved);
  console.log(
    `Orbit captures remounted: ${orbitKeys.length} from ${orbitDir}`,
  );
  res.json(describeOrbitRoot());
});

app.use(
  '/db/meta',
  express.static(path.join(DB_DIR, 'meta'), {
    fallthrough: true,
    index: false,
  }),
);

app.use('/models', (req, res, next) => serveModels(req, res, next));

const unityClientRootResolved = path.resolve(UNITY_CLIENT_ROOT);
if (fs.existsSync(unityClientRootResolved)) {
  console.log(
    `Serving Unity client textures from ${unityClientRootResolved} at /unity-client`,
  );
} else {
  console.log(
    `Unity client not found at ${unityClientRootResolved} (set UNITY_CLIENT_ROOT for BodyTexture previews).`,
  );
}

app.use('/unity-client', (req, res, next) => {
  const rel = decodeURIComponent(req.path).replace(/^\/+/, '').replace(/\\/g, '/');
  if (!rel.startsWith('Assets/') || rel.includes('..')) {
    return res.status(403).json({ message: 'Only Assets/ paths are served.' });
  }
  if (!fs.existsSync(unityClientRootResolved)) {
    return res.status(404).json({ message: 'Unity client root is not configured.' });
  }
  next();
}, express.static(unityClientRootResolved, {
  fallthrough: false,
  index: false,
  dotfiles: 'deny',
}));

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
      characters,
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
  const characterById = new Map(
    characters.filter((c) => c?.id).map((c) => [c.id, c]),
  );
  const mapOpts = {
    includeData,
    includeImages,
    interactionById,
    interactionByLocation,
    toolById,
    equipmentById,
    characterById,
  };

  /** @type {object[]} */
  let results = [];

  // Id-only lookup searches all catalogs; typed queries stay scoped.
  if (body.dataId || body.assetId) {
    results = [
      ...tools.map((t) => mapUnityToolToLibraryAsset(t, mapOpts)),
      ...equipment.map((e) => mapUnityEquipmentToLibraryAsset(e, mapOpts)),
      ...characters.map((c) => mapUnityCharacterToLibraryAsset(c, mapOpts)),
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
    if (assetTypes.includes('character')) {
      results.push(
        ...characters.map((c) => mapUnityCharacterToLibraryAsset(c, mapOpts)),
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
