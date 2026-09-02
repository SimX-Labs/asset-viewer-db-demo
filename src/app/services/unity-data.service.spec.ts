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

describe('UnityDataService audio', () => {
  let service: UnityDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(UnityDataService);
  });

  it('adapts clips into the Audio category with a playable URL', () => {
    const result = service.buildFromText({
      characters: [],
      equipment: [],
      tools: [],
      interactions: [],
      environments: [],
      authoredEnvironments: [],
      audio: [
        {
          id: 'audio-1',
          type: 'audio',
          audioKind: 'sound-effect',
          name: 'Ambient Suburban',
          assetKey: 'Ambient_Suburban',
          addressableGroup: 'environment_sounds',
          clipPath: 'Assets/SimX/Scenes/Environments/SimX_TrainingHouse/Audio/Ambient_Suburban.ogg',
          audioPath: 'audio/media/Ambient_Suburban.3dfe750a.ogg',
          copyStatus: 'copied',
          tags: ['Ambient'],
        },
      ],
      videos: [],
      clothing: [],
      medications: [],
      waveforms: [],
      scenarios: [],
      characterMetadata: [],
      toolMetadata: [],
    });

    const asset = result.assetMap['audio-1'];
    expect(asset._Category).toBe('Audio');
    expect(asset.AssetType).toBe('Sound Effect');
    expect(asset._Source).toBe('client-scrape');
    expect(asset.Data['AudioKind']).toBe('sound-effect');
    expect(asset.Data['AudioUrl']).toBe('db/audio/media/Ambient_Suburban.3dfe750a.ogg');
    expect(asset.Data['CopyStatus']).toBe('copied');
    expect(asset.Tags).toContain('Ambient');
    expect(result.rawData['Unity Asset DB']['Audio'].length).toBe(1);
  });

  it('uses blob URLs for media when loading a local db folder', async () => {
    const jsonFile = (rel: string, body: unknown) => {
      const file = new File([JSON.stringify(body)], rel.split('/').pop()!, {
        type: 'application/json',
      });
      Object.defineProperty(file, 'webkitRelativePath', {
        value: `pack/db/${rel}`,
      });
      return file;
    };
    const ogg = new File(['bytes'], 'loop.ogg', { type: 'audio/ogg' });
    Object.defineProperty(ogg, 'webkitRelativePath', {
      value: 'pack/db/audio/media/loop.ogg',
    });

    const result = await service.buildFromFolderFiles([
      jsonFile('tools/tool-1.json', {
        id: 'tool-1',
        type: 'tool',
        kind: 'tool',
        name: 'Gauze',
        assetKey: 'tool_gauze',
      }),
      jsonFile('audio/audio-1.json', {
        id: 'audio-1',
        type: 'audio',
        audioKind: 'music',
        name: 'Loop',
        audioPath: 'audio/media/loop.ogg',
      }),
      ogg,
    ]);

    expect(result.assetMap['audio-1'].Data['AudioUrl']).toMatch(/^blob:/);
  });
});

describe('UnityDataService body textures', () => {
  let service: UnityDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(UnityDataService);
  });

  it('adapts BodyTexture and OverlayTexture rows into the Characters category', () => {
    const result = service.buildFromText({
      characters: [
        {
          id: 'char-1',
          type: 'character',
          name: 'Adult01 P02',
          assetKey: 'character_core_adult01_p02',
          baseAddressable: 'character_core_adult01_p02',
          isVariant: false,
          isPrimaryInGroup: true,
          groupFolder: 'character_core_adult01',
          prefabPath: 'Assets/patient.prefab',
          interactionLocations: [],
          availableEquipment: [],
          availableClothing: [],
          bodyTextureIds: ['tex-extra', 'tex-default'],
          overlayTextureIds: ['overlay-1'],
          defaultBodyTextureId: 'tex-default',
        },
      ],
      bodyTextures: [
        {
          id: 'tex-default',
          type: 'BodyTexture',
          category: 'character',
          name: 'Ga Skin Body Diffuse',
          assetKey: 'Ga_Skin_Body_Diffuse',
          guid: 'f282e47c4d66acd4aace982d29714b1d',
          texturePath:
            'Assets/SimX/AssetBundles/Humanoids/character_adult01/Textures/Ga_Skin_Body_Diffuse.png',
          isDefault: true,
          characterIds: ['char-1'],
          tags: ['Adult'],
        },
        {
          id: 'tex-extra',
          type: 'BodyTexture',
          category: 'character',
          name: 'Pale Skin',
          assetKey: 'Pale_Skin',
          guid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          texturePath: 'Assets/SimX/pale.psd',
          isDefault: false,
          characterIds: ['char-1'],
          tags: [],
        },
      ],
      overlayTextures: [
        {
          id: 'overlay-1',
          type: 'OverlayTexture',
          category: 'character',
          name: 'WP Neck JunctionalWound',
          assetKey: 'WP_Neck_JunctionalWound_R_Diffuse',
          guid: '0457152b06e950049aa3237467c0a46b',
          texturePath:
            'Assets/SimX/AssetBundles/Humanoids/_Shared Assets/WoundPatterns/WP_Neck_JunctionalWound_R_Diffuse.png',
          baseTextureIds: ['tex-default'],
          characterIds: ['char-1'],
          tags: [],
        },
      ],
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
    });

    const character = result.assetMap['char-1'];
    expect(character._Category).toBe('Characters');
    expect(character.Data['CharacterKind']).toBe('character');
    expect(character.Data['DefaultBodyTexture']).toEqual({ AssetId: 'tex-default' });
    expect(character.Data['BodyTextures']).toEqual([
      { AssetId: 'tex-default' },
      { AssetId: 'tex-extra' },
    ]);
    expect(character.Data['OverlayTextures']).toEqual([{ AssetId: 'overlay-1' }]);

    const tex = result.assetMap['tex-default'];
    expect(tex._Category).toBe('Characters');
    expect(tex.AssetType).toBe('Body Texture (default)');
    expect(tex.Data['CharacterKind']).toBe('body-texture');
    expect(tex.Data['IsDefault']).toBeTrue();
    expect(tex.Data['Characters']).toEqual([{ AssetId: 'char-1' }]);
    expect(tex.Data['OrbitCaptureKey']).toBe(
      'body_texture_f282e47c4d66acd4aace982d29714b1d',
    );
    expect(tex.Data['TextureUrl']).toBe(
      'http://localhost:4301/unity-client/Assets/SimX/AssetBundles/Humanoids/character_adult01/Textures/Ga_Skin_Body_Diffuse.png',
    );
    expect(tex.Tags).toContain('Adult');
    expect(tex._Source).toBe('client-scrape');

    const extra = result.assetMap['tex-extra'];
    expect(extra.AssetType).toBe('Body Texture');
    expect(extra.Data['TextureUrl']).toBeUndefined();
    expect(extra.Data['OrbitCaptureKey']).toBe(
      'body_texture_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );

    const overlay = result.assetMap['overlay-1'];
    expect(overlay.AssetType).toBe('Overlay Texture');
    expect(overlay.Data['CharacterKind']).toBe('overlay-texture');
    expect(overlay.Data['BaseTextures']).toEqual([{ AssetId: 'tex-default' }]);
    expect(overlay.Data['Characters']).toEqual([{ AssetId: 'char-1' }]);
    expect(overlay.Data['OrbitCaptureKey']).toBe(
      'overlay_texture_0457152b06e950049aa3237467c0a46b',
    );
    expect(result.rawData['Unity Asset DB']['Characters'].length).toBe(4);
  });
});

describe('UnityDataService git authorship', () => {
  let service: UnityDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    service = TestBed.inject(UnityDataService);
  });

  it('stamps creator and top contributors onto matching rows', () => {
    const result = service.buildFromText({
      characters: [],
      equipment: [],
      tools: [
        {
          id: 'tool-1',
          type: 'tool',
          kind: 'tool',
          name: 'Pillow',
          assetKey: 'tool_pillow',
          toolId: 'pillow1',
          prefabPath: 'Assets/SimX/AssetBundles/Tools/tool_pillow.prefab',
          metadata: [],
          interactions: [],
          interactionLocations: [],
          usedInGroupIds: [],
          scenarioIds: [],
        },
      ],
      interactions: [],
      environments: [],
      authoredEnvironments: [],
      audio: [],
      videos: [],
      clothing: [],
      medications: [],
      waveforms: [],
      scenarios: [],
      characterMetadata: [],
      toolMetadata: [],
      gitAuthorship: {
        'tool-1': {
          createdBy: { name: 'Jason Ribeira', email: 'jason@simx.com', date: '2020-08-09' },
          lastTouchedBy: {
            name: 'alex.brandt',
            email: 'alex.brandt@simxvr.com',
            date: '2026-02-04',
          },
          contributors: [
            { name: 'alex.brandt', email: 'alex.brandt@simxvr.com', commits: 14 },
            { name: 'Caolan', email: 'caolan@simx.com', commits: 8 },
            { name: 'pfmallon', email: 'pfmallon@simx.com', commits: 3 },
          ],
          otherCommits: 4,
        },
      },
    });

    const data = result.assetMap['tool-1'].Data;
    expect(data['CreatedBy']).toBe('Jason Ribeira <jason@simx.com>');
    expect(data['CreatedOn']).toBe('2020-08-09');
    expect(data['LastUpdatedBy']).toBe('alex.brandt <alex.brandt@simxvr.com>');
    expect(data['LastUpdatedOn']).toBe('2026-02-04');
    expect(data['Contributors']).toEqual([
      { Name: 'alex.brandt <alex.brandt@simxvr.com>', Commits: 14 },
      { Name: 'Caolan <caolan@simx.com>', Commits: 8 },
      { Name: 'pfmallon <pfmallon@simx.com>', Commits: 3 },
    ]);
    expect(data['ContributorOtherCommits']).toBe(4);
  });
});
