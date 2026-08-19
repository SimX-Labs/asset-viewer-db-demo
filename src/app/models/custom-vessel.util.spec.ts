import { UnityTool } from './unity-asset.models';
import {
  adaptVesselToolFields,
  customVesselOrbitCaptureKey,
  resolveOrbitCaptureKey,
  toAssetRefs,
} from './custom-vessel.util';

describe('customVesselOrbitCaptureKey', () => {
  it('flattens authoringId to custom_vessel_<id>', () => {
    expect(customVesselOrbitCaptureKey('Snack Cart-112232')).toBe(
      'custom_vessel_Snack Cart-112232',
    );
  });

  it('trims whitespace and returns empty for blank', () => {
    expect(customVesselOrbitCaptureKey('  supplyCart-686279  ')).toBe(
      'custom_vessel_supplyCart-686279',
    );
    expect(customVesselOrbitCaptureKey('')).toBe('');
    expect(customVesselOrbitCaptureKey('   ')).toBe('');
  });
});

describe('resolveOrbitCaptureKey', () => {
  it('prefers OrbitCaptureKey over AssetKey for custom vessels', () => {
    expect(
      resolveOrbitCaptureKey({
        AssetKey: 'custom_vessel/Snack Cart-112232',
        OrbitCaptureKey: 'custom_vessel_Snack Cart-112232',
      }),
    ).toBe('custom_vessel_Snack Cart-112232');
  });

  it('falls back to AssetKey / AssetAddress', () => {
    expect(resolveOrbitCaptureKey({ AssetKey: 'tool_iv_bag' })).toBe('tool_iv_bag');
    expect(resolveOrbitCaptureKey({ AssetAddress: 'tool_aed' })).toBe('tool_aed');
  });
});

describe('adaptVesselToolFields', () => {
  function customVessel(overrides: Partial<UnityTool> = {}): UnityTool {
    return {
      id: 'bca45e84-8285-5e0e-a211-f14b627b0a06',
      type: 'tool',
      kind: 'vessel',
      vesselType: 'custom',
      name: 'Snack Cart',
      assetKey: 'custom_vessel/Snack Cart-112232',
      authoringId: 'Snack Cart-112232',
      toolId: 'Snack Cart-112232',
      prefabPath: null,
      emptyVesselId: '7ca7c8de-ff13-56cb-a061-1086a1a99bef',
      emptyVesselAssetKey: 'group_cart_customizable',
      containedToolIds: ['fa3f024b-43af-5d2a-84a3-1a41d66244a7'],
      containedToolAssetKeys: ['tool_juice_box'],
      containers: [
        {
          state: '1',
          toolIds: ['fa3f024b-43af-5d2a-84a3-1a41d66244a7'],
          toolAssetKeys: ['tool_juice_box'],
        },
        { state: 'outside', toolIds: [], toolAssetKeys: [] },
      ],
      packets: [{ key: 'body', type: 'Color', value: '321044' }],
      metadata: [],
      interactions: [],
      interactionLocations: [],
      usedInGroupIds: [],
      scenarioIds: [],
      ...overrides,
    };
  }

  it('maps base vessel, contained tools, containers, customization, and orbit key', () => {
    const data = adaptVesselToolFields(customVessel());
    expect(data['AuthoringId']).toBe('Snack Cart-112232');
    expect(data['OrbitCaptureKey']).toBe('custom_vessel_Snack Cart-112232');
    expect(data['BaseEmptyVessel']).toEqual({
      AssetId: '7ca7c8de-ff13-56cb-a061-1086a1a99bef',
    });
    expect(data['ContainedTools']).toEqual(
      toAssetRefs(['fa3f024b-43af-5d2a-84a3-1a41d66244a7']),
    );
    expect(data['Containers']).toEqual([
      {
        State: '1',
        Tools: [{ AssetId: 'fa3f024b-43af-5d2a-84a3-1a41d66244a7' }],
      },
      { State: 'outside', Tools: [] },
    ]);
    expect(data['Customization']).toEqual([
      { Key: 'body', Type: 'Color', Value: '321044' },
    ]);
  });

  it('maps empty-vessel reverse CustomVessels without ContainedTools', () => {
    const data = adaptVesselToolFields({
      id: '7ca7c8de-ff13-56cb-a061-1086a1a99bef',
      type: 'tool',
      kind: 'vessel',
      vesselType: 'empty',
      name: 'Cart Customizable',
      assetKey: 'group_cart_customizable',
      toolId: 'airwayCartTrauma',
      prefabPath: 'Assets/foo.prefab',
      customVesselIds: ['bca45e84-8285-5e0e-a211-f14b627b0a06'],
      metadata: [],
      interactions: [],
      interactionLocations: [],
      usedInGroupIds: [],
      scenarioIds: [],
    });
    expect(data['CustomVessels']).toEqual([
      { AssetId: 'bca45e84-8285-5e0e-a211-f14b627b0a06' },
    ]);
    expect(data['ContainedTools']).toBeUndefined();
    expect(data['OrbitCaptureKey']).toBeUndefined();
  });

  it('returns empty for non-vessel tools', () => {
    expect(
      adaptVesselToolFields({
        id: 'x',
        type: 'tool',
        kind: 'tool',
        name: 'Syringe',
        assetKey: 'tool_med',
        toolId: 'syringe',
        prefabPath: 'a.prefab',
        metadata: [],
        interactions: [],
        interactionLocations: [],
        usedInGroupIds: [],
        scenarioIds: [],
      }),
    ).toEqual({});
  });
});
