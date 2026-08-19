import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { UnityDataService } from './unity-data.service';
import { UnityDbBundle } from '../models/unity-asset.models';

describe('UnityDataService authored environment placements', () => {
  let service: UnityDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(UnityDataService);
  });

  it('builds a positioned hierarchy with vessel shells but no vessel contents', () => {
    const bundle: UnityDbBundle = {
      characters: [],
      equipment: [],
      tools: [],
      interactions: [],
      environments: [],
      audio: [],
      clothing: [],
      medications: [],
      waveforms: [],
      scenarios: [],
      characterMetadata: [],
      toolMetadata: [],
      authoredEnvironments: [
        {
          id: 'environment-row',
          type: 'authored-environment',
          name: 'Field Hospital',
          assetKey: 'field-hospital',
          toolPlacements: [
            {
              kind: 'tool',
              assetKey: 'tool_scalpel',
              toolRowId: 'scalpel-row',
              toolId: 'scalpel-1',
              positionData: {
                worldPosition: { x: 1, y: 2, z: 3 },
                worldRotation: { x: 0, y: 90, z: 0 },
              },
            },
            {
              kind: 'custom-vessel',
              assetKey: 'custom_vessel/shared-cart',
              toolRowId: 'shared-cart-row',
              toolId: 'cart-1',
              customVesselKey: 'shared-cart',
              sharedLibrary: true,
              positionData: {
                worldPosition: { x: 4, y: 5, z: 6 },
                worldRotation: { x: 0, y: 180, z: 0 },
              },
            },
            {
              kind: 'custom-vessel',
              assetKey: 'custom_vessel/inline-cart',
              toolId: 'cart-2',
              customVesselKey: 'inline-cart',
              sharedLibrary: false,
              positionData: {
                worldPosition: { x: 7, y: 8, z: 9 },
              },
            },
          ],
        },
      ],
    };

    const result = service.buildFromText(bundle);
    const asset = result.assetMap['environment-row'];
    const roots = asset.ToolHierarchyData?.Roots ?? [];

    expect(roots.map((node) => node.ToolId)).toEqual([
      'scalpel-1',
      'cart-1',
      'cart-2',
    ]);
    expect(roots[0].Position).toEqual({ x: 1, y: 2, z: 3 });
    expect(roots[0].Rotation).toEqual({ x: 0, y: 90, z: 0 });
    expect(roots[1].PlacementKind).toBe('custom-vessel');
    expect(roots[1].SharedLibrary).toBeTrue();
    expect(roots[2].SharedLibrary).toBeFalse();

    const placed = asset.Data['PlacedTools'] as Record<string, unknown>[];
    expect(placed.length).toBe(3);
    expect(placed.some((group) => group['AssetKey'] === 'tool_inside_cart')).toBeFalse();
    expect(asset.Data['ToolHierarchy']).toBe(asset.ToolHierarchyData);
    expect(asset._Source).toBe('shared-library-git');
  });
});

describe('UnityDataService scrape source', () => {
  let service: UnityDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(UnityDataService);
  });

  function emptyBundle(): UnityDbBundle {
    return {
      characters: [],
      equipment: [],
      tools: [],
      interactions: [],
      environments: [],
      authoredEnvironments: [],
      audio: [],
      clothing: [],
      medications: [],
      waveforms: [],
      scenarios: [],
      characterMetadata: [],
      toolMetadata: [],
    };
  }

  it('stamps the pipeline origin on each adapted row', () => {
    const bundle = emptyBundle();
    bundle.characters = [
      {
        id: 'char-1',
        type: 'character',
        name: 'Patient',
        assetKey: 'core_patient',
        baseAddressable: 'core_patient',
        isVariant: false,
        isPrimaryInGroup: true,
        groupFolder: 'patient',
        prefabPath: 'Assets/patient.prefab',
        interactionLocations: [],
        availableEquipment: [],
        availableClothing: [],
      },
    ];
    bundle.medications = [
      {
        id: 'med-1',
        type: 'medication',
        name: 'Acetaminophen',
        medId: 'acetaminophen',
        medContainer: 'vial',
      },
    ];
    bundle.waveforms = [
      {
        id: 'wave-1',
        type: 'waveform',
        name: 'NSR',
        dataPoints: [0, 1, 0],
        waveCount: 1,
      },
    ];
    bundle.tools = [
      {
        id: 'tool-1',
        type: 'tool',
        kind: 'tool',
        name: 'Scalpel',
        assetKey: 'tool_scalpel',
        toolId: 'scalpel',
        prefabPath: 'Assets/scalpel.prefab',
        metadata: [],
        interactions: [],
        interactionLocations: [],
        usedInGroupIds: [],
        scenarioIds: [],
      },
      {
        id: 'empty-1',
        type: 'tool',
        kind: 'vessel',
        vesselType: 'empty',
        name: 'Cart',
        assetKey: 'vessel_cart',
        toolId: 'cart',
        prefabPath: 'Assets/cart.prefab',
        metadata: [],
        interactions: [],
        interactionLocations: [],
        usedInGroupIds: [],
        scenarioIds: [],
      },
      {
        id: 'custom-1',
        type: 'tool',
        kind: 'vessel',
        vesselType: 'custom',
        name: 'Snack Cart',
        assetKey: 'custom_vessel/snack',
        toolId: 'snack',
        prefabPath: null,
        metadata: [],
        interactions: [],
        interactionLocations: [],
        usedInGroupIds: [],
        scenarioIds: [],
      },
    ];

    const result = service.buildFromText(bundle);
    expect(result.assetMap['char-1']._Source).toBe('client-scrape');
    expect(result.assetMap['tool-1']._Source).toBe('client-scrape');
    expect(result.assetMap['empty-1']._Source).toBe('client-scrape');
    expect(result.assetMap['custom-1']._Source).toBe('shared-library-git');
    expect(result.assetMap['med-1']._Source).toBe('api-db');
    expect(result.assetMap['wave-1']._Source).toBe('scenario-creator');
  });
});

describe('UnityDataService videos', () => {
  let service: UnityDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(UnityDataService);
  });

  it('adapts ultrasound clips into the Videos category', () => {
    const result = service.buildFromText({
      characters: [],
      equipment: [],
      tools: [],
      interactions: [],
      environments: [],
      authoredEnvironments: [],
      audio: [],
      videos: [
        {
          id: 'video-1',
          type: 'video',
          videoKind: 'ultrasound',
          name: 'Abscess',
          assetKey: 'Assets/SimX/AssetBundles/Videos/Ultrasound/Abscess/AbnormalAbscess.anim',
          addressableGroup: 'ultrasound_videos',
          addressableLabels: ['us_abnormal'],
          duration: 12.1,
          fps: 10,
          loop: true,
          frameCount: 121,
          videoPath: 'videos/media/abscess.mp4',
          posterPath: 'videos/media/abscess.poster.jpg',
          encodeStatus: 'encoded',
        },
      ],
      clothing: [],
      medications: [],
      waveforms: [],
      scenarios: [],
      characterMetadata: [],
      toolMetadata: [],
    });

    const asset = result.assetMap['video-1'];
    expect(asset._Category).toBe('Videos');
    expect(asset.AssetType).toBe('Ultrasound Video');
    expect(asset._Source).toBe('client-scrape');
    expect(asset.Data['VideoKind']).toBe('ultrasound');
    expect(asset.Data['VideoUrl']).toBe('db/videos/media/abscess.mp4');
    expect(asset.Data['PosterUrl']).toBe('db/videos/media/abscess.poster.jpg');
    expect(asset.Data['Loop']).toBeTrue();
    expect(asset.Tags).toContain('us_abnormal');
    expect(result.rawData['Unity Asset DB']['Videos'].length).toBe(1);
  });
});
