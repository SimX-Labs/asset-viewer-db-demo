import {
  dataSourceLabel,
  sourceForCategory,
  sourceForUnityAsset,
} from './data-source';

describe('sourceForCategory', () => {
  it('maps client-scraped Unity types', () => {
    expect(sourceForCategory('Tooling', 'tool')).toBe('client-scrape');
    expect(sourceForCategory('Tooling', 'kit')).toBe('client-scrape');
    expect(sourceForCategory('Tooling', 'group')).toBe('client-scrape');
    expect(sourceForCategory('Vessels', 'empty')).toBe('client-scrape');
    expect(sourceForCategory('Audio', 'music')).toBe('client-scrape');
    expect(sourceForCategory('Audio', 'sound-effect')).toBe('client-scrape');
    expect(sourceForCategory('Audio', 'background-audio')).toBe('client-scrape');
    expect(sourceForCategory('Videos', 'ultrasound')).toBe('client-scrape');
    expect(sourceForCategory('Characters')).toBe('client-scrape');
    expect(sourceForCategory('Equipment')).toBe('client-scrape');
    expect(sourceForCategory('Clothing')).toBe('client-scrape');
    expect(sourceForCategory('Environments')).toBe('client-scrape');
    expect(sourceForCategory('Interactions')).toBe('client-scrape');
    expect(sourceForCategory('Character Metadata')).toBe('client-scrape');
    expect(sourceForCategory('Tool Metadata')).toBe('client-scrape');
    expect(sourceForCategory('Scenes')).toBe('client-scrape');
  });

  it('maps shared-library and API sources', () => {
    expect(sourceForCategory('Vessels', 'custom')).toBe('shared-library-git');
    expect(sourceForCategory('Authored Environments')).toBe('shared-library-git');
    expect(sourceForCategory('Medications')).toBe('api-db');
  });

  it('maps scenario-creator scrapes and unknown types', () => {
    expect(sourceForCategory('Waveforms')).toBe('scenario-creator');
    expect(sourceForCategory('Scenarios')).toBe('scenario-creator');
    expect(sourceForCategory('Something Else')).toBe('unknown');
    expect(dataSourceLabel('unknown')).toBe('Unknown');
  });
});

describe('sourceForUnityAsset', () => {
  function asset(
    category: string,
    data: Record<string, unknown> = {},
  ): { _Category: string; Data: Record<string, unknown> } {
    return { _Category: category, Data: data };
  }

  it('uses VesselType so empty and custom vessels differ', () => {
    expect(sourceForUnityAsset(asset('Vessels', { VesselType: 'empty' }))).toBe(
      'client-scrape',
    );
    expect(sourceForUnityAsset(asset('Vessels', { VesselType: 'custom' }))).toBe(
      'shared-library-git',
    );
    expect(sourceForUnityAsset(asset('Vessels'))).toBe('client-scrape');
  });

  it('does not require a subcategory for flat types', () => {
    expect(sourceForUnityAsset(asset('Characters'))).toBe('client-scrape');
    expect(sourceForUnityAsset(asset('Medications'))).toBe('api-db');
    expect(sourceForUnityAsset(asset('Authored Environments'))).toBe(
      'shared-library-git',
    );
  });
});
