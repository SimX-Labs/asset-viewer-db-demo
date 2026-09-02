import {
  classifyPackPath,
  indexDbFiles,
  looksLikeDbContentPath,
  normalizeRelativePath,
} from './local-data-pack.util';

function fileAt(rel: string): File {
  const f = new File(['{}'], rel.split('/').pop() ?? rel, {
    type: 'application/json',
  });
  Object.defineProperty(f, 'webkitRelativePath', { value: rel });
  return f;
}

describe('local-data-pack.util', () => {
  it('normalizes slashes', () => {
    expect(normalizeRelativePath('db\\characters\\a.json')).toBe(
      'db/characters/a.json',
    );
  });

  it('classifies a zip-root pick', () => {
    expect(classifyPackPath('pack/db/characters/scalpel.json')).toEqual({
      kind: 'db',
      inner: 'characters/scalpel.json',
    });
    expect(classifyPackPath('pack/assets/tool_gauze/manifest.json')).toEqual({
      kind: 'assets',
      inner: 'tool_gauze/manifest.json',
    });
  });

  it('classifies db/ and assets/ as the first segment', () => {
    expect(classifyPackPath('db/index.json')).toEqual({
      kind: 'db',
      inner: 'index.json',
    });
    expect(classifyPackPath('assets/tool_x/model.glb')).toEqual({
      kind: 'assets',
      inner: 'tool_x/model.glb',
    });
  });

  it('treats a bare db-tree pick as db content', () => {
    expect(looksLikeDbContentPath('characters/scalpel.json')).toBeTrue();
    expect(looksLikeDbContentPath('body-textures/skin.json')).toBeTrue();
    expect(looksLikeDbContentPath('overlay-textures/wound.json')).toBeTrue();
    expect(classifyPackPath('characters/scalpel.json')).toEqual({
      kind: 'db',
      inner: 'characters/scalpel.json',
    });
    expect(classifyPackPath('index.json')).toEqual({
      kind: 'db',
      inner: 'index.json',
    });
  });

  it('accepts models/ and EXPORT/ as assets aliases', () => {
    expect(classifyPackPath('EXPORT/tool_x/manifest.json')).toEqual({
      kind: 'assets',
      inner: 'tool_x/manifest.json',
    });
    expect(classifyPackPath('models/tool_x/model.glb')).toEqual({
      kind: 'assets',
      inner: 'tool_x/model.glb',
    });
  });

  it('indexes only db files from a mixed webkitdirectory list', () => {
    const files = [
      fileAt('preview/db/characters/a.json'),
      fileAt('preview/db/index.json'),
      fileAt('preview/assets/tool_x/manifest.json'),
      fileAt('preview/assets/tool_x/model.glb'),
    ];
    const byRel = indexDbFiles(files);
    expect([...byRel.keys()].sort()).toEqual([
      'characters/a.json',
      'index.json',
    ]);
  });
});
