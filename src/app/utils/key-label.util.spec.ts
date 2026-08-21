import { humanizeKey } from './key-label.util';

describe('humanizeKey', () => {
  it('splits PascalCase field names into words', () => {
    expect(humanizeKey('EnvironmentAssetKey')).toBe('Environment Asset Key');
    expect(humanizeKey('RootToolEntryCount')).toBe('Root Tool Entry Count');
    expect(humanizeKey('UsedInAuthoredEnvironments')).toBe(
      'Used In Authored Environments',
    );
  });

  it('keeps acronym runs together', () => {
    expect(humanizeKey('AssetGUID')).toBe('Asset GUID');
    expect(humanizeKey('HasWebGLView')).toBe('Has Web GL View');
    expect(humanizeKey('ScenarioCreatorId')).toBe('Scenario Creator Id');
  });

  it('handles digits, separators, and single words', () => {
    expect(humanizeKey('MaxHr')).toBe('Max Hr');
    expect(humanizeKey('source_file')).toBe('source file');
    expect(humanizeKey('Tags')).toBe('Tags');
    expect(humanizeKey('')).toBe('');
  });
});
