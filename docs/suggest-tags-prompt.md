# Prompt: suggested tags per asset type

Paste the block below into a Cursor chat that has **unity-client-alt** and **unity-asset-documentation** in the workspace (the Unity client plus the scraped asset DB). Ask it only for the list — not for code changes.

The goal is an authored tag vocabulary for the asset viewer: one **Global** list (usable on any type) plus **type-specific** tags for each sidebar category that exists today.

---

```
You are helping SimX design authored tags for our Unity Asset Database viewer.

SimX is a VR medical simulation product. The asset viewer lets authors and engineers browse the catalog (tools, characters, environments, medications, etc.) and filter the list by tags. Tags are either:

- Global — can be applied to any asset type
- Type-scoped — apply only to one sidebar type (Tooling, Characters, …)

Do not write or edit code. Do not invent scrape rules. Return a suggested tag list only.

## How to research (do this first)

Ground every suggestion in what actually exists. Scan, do not guess:

1. `C:\SimX\unity-asset-documentation\db` — row JSON (`tools/`, `characters/`, `equipment/`, `environments/`, `authored-environments/`, `audio/`, `videos/`, `interactions/`, plus `clothing.json`, `medications.json`, `waveforms.json`, `scenarios.json`, `character-metadata.json`, `tool-metadata.json`). Use `db/index.json` for file lists and counts.
2. `C:\SimX\unity-client-alt\Assets\SimX` — prefab folder names, addressable groups, and naming conventions (`tool_*`, `character_core_*`, `env_*`, `equipment_*`).
3. Prefab / addressable folder structure under `Assets/SimX/AssetBundles` (especially Tools, Equipment, Humanoids, Environments) — folder names are a strong signal for Tooling and Equipment facets.

When you cite examples, use real `assetKey` / display names from the DB.

## Catalog types currently in the viewer

Use these groups and no others. Approximate sizes from the latest scrape are in parentheses.

| Type | What it is | Do not restate as a tag |
|------|------------|-------------------------|
| **Tooling** | Handheld / placeable sim tools, kits, and groups (`kind`: tool, kit, group). ~1333 tool rows total including vessels. | `tool` / `kit` / `group` (already a sidebar subcategory). Scraped: **Grabbable**, **Prop**, **Generator**. |
| **Vessels** | Empty vessel prefabs and authored custom vessels (`kind`: vessel). Split Empty vs Custom in the sidebar. | `empty` / `custom`. |
| **Audio** | Music and environment SFX clips. Sidebar: Music, Sound Effects, Background Audio (reserved, often empty). ~42. | `music` / `sound-effect` / `background-audio`. |
| **Videos** | Ultrasound loops. Addressable labels (e.g. `us_abnormal`, `us_canine`) are already stored as tags on rows. ~78. | `ultrasound` as a kind. Do not duplicate existing label tags unless you are proposing a cleaner human label and saying so. |
| **Characters** | Core character prefabs and their variants (`character_core_*`, including `_pNN` variants). ~127. Variant vs base is already first-class (`isVariant` / AssetType). Scraped: **Core** (all `_core_` keys, including variants). | Age/body from the key is OK to facet if it helps filtering (e.g. Newborn vs Adult), but do not add a “Core Variant” scrape-style tag. |
| **Equipment** | Wearable / attachable character equipment (`equipment_*`, IV sites, monitors, etc.). ~608. | The word “Equipment”. |
| **Clothing** | Master clothing rows worn by characters. | The word “Clothing”. |
| **Medications** | Medication database rows (IV bags, vials, syringes, pills, …), not tool prefabs. `medContainer` is already in AssetType. | Container type if it is already in the type string (IVBag, Vial, …) — prefer clinical class / use instead. |
| **Waveforms** | Monitor waveform traces used in cases (e.g. Afib). | The word “Waveform”. |
| **Scenarios** | Summary rows imported from scenario-creator cases. | The word “Scenario”. |
| **Scenes** | Rare `kind: scene` tool rows, if any. OK to suggest few tags or “none yet”. | |
| **Environments** | Base Unity environment scenes (`env_*`). ~315. Scraped: **Core** when `assetKey` contains `_core_`. | The word “Environment”. |
| **Authored Environments** | Authored `.env` layouts on top of a Model scene. ~18. | Do not confuse with Environments (the Model). |
| **Interactions** | Catalog of interaction locations (where tools meet characters/equipment/tools). ~939. | Location string itself as a tag. |
| **Character Metadata** | Patient-script metadata keys (not 3D assets). | The metadata `key` name. |
| **Tool Metadata** | Shared tool metadata keys (not 3D assets). | The metadata `key` name. |

## Tags that already exist (do not duplicate)

Scraped, locked, already on rows:

- Tooling: **Grabbable**, **Prop**, **Generator**
- Characters and Environments: **Core**

Global authored tags: none yet. Type authored tags: none yet besides the scraped ones above.

## What a good tag looks like

- Short Title Case label, 1–3 words (e.g. `Airway`, `Vascular Access`, `Military`).
- Useful as a filter: it should match a meaningful slice of that type, not a single unique asset name.
- Clinical or functional (how authors look for the asset), not a restatement of `AssetName` or `assetKey`.
- Global only if it is truly meaningful across several types (e.g. a setting, population, or review state). If it only makes sense on tools, put it on Tooling.
- Prefer 8–20 tags for dense types (Tooling, Equipment, Characters, Medications, Environments). Sparse types may have fewer; say so rather than padding.
- Do not propose tags we can already get from sidebar subcategories, AssetType, or the scraped tags above.

## Output format

Return markdown, nothing else.

1. **Global** — bullet list. Each bullet: `Label` — one-line rationale. Optionally `(e.g. assetKey, assetKey)`.
2. One heading per type in the table above, same bullet shape.
3. If a type should have no extra tags, write `None suggested` and why.
4. End with a short **Open questions** list (ambiguities, tags you almost proposed, types that need a human SME).

Do not assign tags to individual assets in this pass. This is vocabulary only.
```
