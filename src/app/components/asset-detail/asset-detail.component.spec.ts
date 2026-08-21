import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AssetDetailComponent } from './asset-detail.component';
import { DboAsset } from '../../models/dbo.models';
import { AppStateService } from '../../services/app-state.service';
import { AssetMetaService } from '../../services/asset-meta.service';
import { TagTaxonomyService } from '../../services/tag-taxonomy.service';
import { emptyAssetMetaRecord } from '../../models/asset-meta.models';
import { CUSTOM_TAG_CATEGORY_ID } from '../../models/tag.models';
import { OrbitModelControlsService } from '../../orbit-capture/services/orbit-model-controls.service';

describe('AssetDetailComponent custom vessel', () => {
  let fixture: ComponentFixture<AssetDetailComponent>;
  let component: AssetDetailComponent;

  const customVesselAsset: DboAsset = {
    AssetId: 'bca45e84-8285-5e0e-a211-f14b627b0a06',
    AssetName: 'Snack Cart',
    AssetType: 'Custom Vessel',
    Data: {
      AssetKey: 'custom_vessel/Snack Cart-112232',
      VesselType: 'custom',
      AuthoringId: 'Snack Cart-112232',
      OrbitCaptureKey: 'custom_vessel_Snack Cart-112232',
      BaseEmptyVessel: { AssetId: '7ca7c8de-ff13-56cb-a061-1086a1a99bef' },
      ContainedTools: [{ AssetId: 'fa3f024b-43af-5d2a-84a3-1a41d66244a7' }],
      Containers: [
        {
          State: '1',
          Tools: [{ AssetId: 'fa3f024b-43af-5d2a-84a3-1a41d66244a7' }],
        },
        { State: 'outside', Tools: [] },
      ],
      Customization: [{ Key: 'body', Type: 'Color', Value: '321044' }],
      CompatibleEquipment: [],
    },
    Tags: [],
    _Category: 'Vessels',
    _File: 'unity',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetDetailComponent],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetDetailComponent);
    component = fixture.componentInstance;
    component.asset = customVesselAsset;
    fixture.detectChanges();
  });

  it('resolves orbit lookup via flat OrbitCaptureKey', () => {
    expect(component.orbitAddressable()).toBe('custom_vessel_Snack Cart-112232');
  });

  it('exposes base vessel, contained tools, and containers for rendering', () => {
    expect(component.isCustomVessel()).toBeTrue();
    expect(component.showCustomVesselComposition()).toBeTrue();
    expect(component.baseEmptyVessel()?.AssetId).toBe(
      '7ca7c8de-ff13-56cb-a061-1086a1a99bef',
    );
    expect(component.vesselContainedTools().length).toBe(1);
    expect(component.vesselContainers().map((c) => c.State)).toEqual(['1', 'outside']);
  });

  it('omits composition keys from the property table', () => {
    const keys = component.dataKeys();
    expect(keys).not.toContain('BaseEmptyVessel');
    expect(keys).not.toContain('ContainedTools');
    expect(keys).not.toContain('Containers');
    expect(keys).not.toContain('Customization');
    expect(keys).toContain('OrbitCaptureKey');
    expect(keys).toContain('AssetKey');
  });

  it('shows the shared-library source next to the type', () => {
    const host = fixture.nativeElement as HTMLElement;
    const tag = host.querySelector('.header-tags .source-tag');
    expect(tag?.textContent?.trim()).toBe('Shared library git');
    expect(tag?.getAttribute('data-source')).toBe('shared-library-git');
    expect(host.querySelector('.prop-table .source-tag')).toBeNull();
    expect(host.querySelector('.source-row')).toBeNull();
  });

  it('renders the base vessel as a line item and one contained-tool list', () => {
    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';
    expect(host.querySelector('.vessel-base-row')).toBeTruthy();
    expect(text).toContain('Base empty vessel:');
    expect(text).toContain('Contained Tools (1)');
    expect(text).not.toContain('By Container');
  });

  it('lists every contained tool when the model has no container controls', () => {
    expect(component.toolScopeToggleAvailable()).toBeFalse();
    expect(component.visibleContainedTools().length).toBe(1);
  });

  describe('with model container controls', () => {
    let controls: OrbitModelControlsService;

    beforeEach(() => {
      controls = fixture.debugElement.injector.get(OrbitModelControlsService);
      controls.load({
        images: [],
        vesselContainers: {
          managedNodeIds: [],
          containers: [
            {
              id: '1',
              defaultOpen: false,
              toggleable: true,
              incompatibleContainerIds: [],
              shownNodeIds: [],
              hiddenNodeIds: [],
            },
            {
              id: '2',
              defaultOpen: false,
              toggleable: true,
              incompatibleContainerIds: [],
              shownNodeIds: [],
              hiddenNodeIds: [],
            },
          ],
        },
      });
    });

    it('scopes the list to the open containers, and toggles to all', () => {
      expect(component.toolScopeToggleAvailable()).toBeTrue();
      expect(component.visibleContainedTools().length).toBe(0);

      controls.toggleContainer(controls.containerOptions()[0]);
      expect(component.visibleContainedTools().map((t) => t.AssetId)).toEqual([
        'fa3f024b-43af-5d2a-84a3-1a41d66244a7',
      ]);

      component.toggleContainedToolScope();
      controls.toggleContainer(controls.containerOptions()[0]);
      expect(component.containedToolScope()).toBe('all');
      expect(component.visibleContainedTools().length).toBe(1);
    });

    it('keeps the tool list out of the composition block so it sits by the containers', () => {
      expect(component.showInlineModelControls()).toBeTrue();
      expect(component.showCustomVesselComposition()).toBeTrue();
    });
  });
});

describe('AssetDetailComponent git authorship', () => {
  let fixture: ComponentFixture<AssetDetailComponent>;
  let component: AssetDetailComponent;

  const toolAsset: DboAsset = {
    AssetId: 'tool-1',
    AssetName: 'Pillow',
    AssetType: 'Tool',
    Data: {
      AssetKey: 'tool_pillow',
      PrefabPath: 'Assets/SimX/AssetBundles/Tools/tool_pillow.prefab',
      CreatedBy: 'Jason Ribeira <jason@simx.com>',
      CreatedOn: '2020-08-09',
      LastUpdatedBy: 'alex.brandt <alex.brandt@simxvr.com>',
      LastUpdatedOn: '2026-02-04',
      Contributors: [
        { Name: 'alex.brandt <alex.brandt@simxvr.com>', Commits: 14 },
        { Name: 'Caolan <caolan@simx.com>', Commits: 8 },
        { Name: 'pfmallon <pfmallon@simx.com>', Commits: 3 },
      ],
    },
    Tags: [],
    _Category: 'Tooling',
    _File: 'unity',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetDetailComponent],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetDetailComponent);
    component = fixture.componentInstance;
    component.asset = toolAsset;
    fixture.detectChanges();
  });

  it('uses an icon-only pin control at the start of the header', () => {
    const host = fixture.nativeElement as HTMLElement;
    const header = host.querySelector('.header-row');
    const pin = header?.querySelector('.pin-btn');
    expect(pin).toBeTruthy();
    expect(header?.querySelector('.header-leading')?.firstElementChild).toBe(pin);
    expect(pin?.textContent?.trim()).toBe('');
    expect(pin?.getAttribute('aria-label')).toBe('Pin');
  });

  it('keeps notes in the main column without comments', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(
      host.querySelector('.asset-detail-main .status-label')?.textContent,
    ).toContain('Status');
    expect(
      host.querySelector('.asset-detail-main .notes-head .status-label')?.textContent,
    ).toContain('Notes');
    expect(host.querySelector('.asset-detail-main .meta-panel-title')).toBeNull();
    expect(host.querySelector('.comments-title')).toBeNull();
    expect(host.querySelector('.git-authorship')).toBeNull();
    expect(host.querySelector('.asset-summary-copy .asset-title')).toBeTruthy();
  });

  it('keeps git fields out of the property table', () => {
    expect(component.dataKeys()).not.toContain('CreatedBy');
    expect(component.dataKeys()).not.toContain('LastUpdatedBy');
    expect(component.dataKeys()).not.toContain('Contributors');
    expect(component.dataKeys()).toContain('AssetKey');
  });
});

describe('AssetDetailComponent authored environment', () => {
  let fixture: ComponentFixture<AssetDetailComponent>;
  let component: AssetDetailComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetDetailComponent],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetDetailComponent);
    component = fixture.componentInstance;
    component.asset = {
      AssetId: 'authored-env-id',
      AssetName: 'Field Hospital',
      AssetType: 'Authored Environment',
      Data: {
        AuthoringId: 'Field Hospital-4471',
        LastSaved: '2026-02-11T19:37:55.123Z',
        AuthoringToolVersion: '1.4.0',
        RootToolEntryCount: 12,
        SourceFile: 'C:/SimX/authored/Field Hospital.es3',
        Tools: [{ AssetId: 'tool-door-handle' }, { AssetId: 'tool-scalpel' }],
        PlacedTools: [
          {
            AssetId: 'tool-door-handle',
            AssetKey: 'tool_door_handle',
            Count: 2,
            Instances: [
              { ToolId: 'handle_outside', Source: 'layout' },
              { ToolId: 'handle_inside', Source: 'layout' },
            ],
          },
          {
            AssetId: 'tool-scalpel',
            AssetKey: 'tool_scalpel',
            Count: 1,
            Instances: [
              { ToolId: 'scalpel1' },
            ],
          },
          {
            AssetId: 'empty-bed',
            AssetKey: 'group_hospital_bed',
            Count: 1,
            Instances: [{ ToolId: 'adjustableBed1' }],
          },
          {
            AssetId: 'empty-cart',
            AssetKey: 'group_procedure_cart',
            Count: 2,
            Instances: [{ ToolId: 'procedureCart1' }, { ToolId: 'procedureCart2' }],
          },
          {
            AssetKey: 'custom_vessel/inline-cart',
            Kind: 'custom-vessel',
            CustomVesselKey: 'inline-cart',
            SharedLibrary: false,
            Count: 1,
            Instances: [{ ToolId: 'nursingCart' }],
          },
        ],
      },
      Tags: [],
      _Category: 'Authored Environments',
      _File: 'unity',
    };
    const state = TestBed.inject(AppStateService);
    // Only the door handle has a tool row; the scalpel stands in for an unexported prefab.
    state.assetMap.set({
      'tool-door-handle': {
        AssetId: 'tool-door-handle',
        AssetName: 'Door Handle',
        AssetType: 'Tool',
        Data: {},
        Tags: [],
        _Category: 'Tooling',
        _File: 'unity',
      },
      'empty-bed': {
        AssetId: 'empty-bed',
        AssetName: 'Adjustable Hospital Bed',
        AssetType: 'Empty Vessel',
        Data: {},
        Tags: [],
        _Category: 'Vessels',
        _File: 'unity',
      },
      'empty-cart': {
        AssetId: 'empty-cart',
        AssetName: 'Procedure Cart',
        AssetType: 'Empty Vessel',
        Data: {},
        Tags: [],
        _Category: 'Vessels',
        _File: 'unity',
      },
    });
    fixture.detectChanges();
  });

  it('moves export bookkeeping out of the property table', () => {
    expect(component.dataKeys()).toEqual(['AuthoringId', 'LastSaved']);
    expect(component.advancedKeys()).toEqual([
      'AuthoringToolVersion',
      'RootToolEntryCount',
      'SourceFile',
    ]);
  });

  it('keeps the advanced section collapsed until clicked', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.advanced-list')).toBeNull();

    host.querySelector<HTMLButtonElement>('.advanced-toggle')!.click();
    fixture.detectChanges();

    const items = host.querySelectorAll('.advanced-item');
    expect(items.length).toBe(3);
    expect(host.textContent).toContain('Root Tool Entry Count');
  });

  it('spaces out field names but keeps the raw key on hover', () => {
    const host = fixture.nativeElement as HTMLElement;
    const labels = Array.from(host.querySelectorAll('.prop-key-label')).map(
      (el) => el.textContent?.trim(),
    );
    expect(labels).toEqual(['Authoring Id', 'Last Saved']);
    expect(host.querySelector('.prop-key[title]')!.getAttribute('title')).toBe(
      'AuthoringId',
    );
    expect(host.querySelector('.prop-caret')).toBeNull();
  });

  it('shortens LastSaved to the minute and keeps the raw value on hover', () => {
    const host = fixture.nativeElement as HTMLElement;
    const cell = host.querySelector<HTMLElement>('.datetime-value')!;
    expect(cell.textContent).not.toContain('55');
    expect(cell.title).toBe('2026-02-11T19:37:55.123Z');
  });

  it('totals placements and drops the duplicate tool link list', () => {
    expect(component.placedToolTotal()).toBe(7);
    expect(component.dataKeys()).not.toContain('Tools');
    expect(component.dataKeys()).not.toContain('PlacedTools');
  });

  it('lists vessels only and uses the instance name for local vessels', () => {
    const host = fixture.nativeElement as HTMLElement;
    const headings = Array.from(host.querySelectorAll('.simx-section-heading')).map((el) =>
      el.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(headings).toContain('Vessels');

    const rows = host.querySelectorAll('.placed-tool-row');
    expect(rows.length).toBe(3);
    expect(host.textContent).not.toContain('Door Handle');
    expect(host.textContent).not.toContain('tool_scalpel');

    expect(rows[0].querySelector('a.placed-tool-name')?.textContent?.trim()).toBe(
      'Adjustable Hospital Bed',
    );
    expect(rows[0].querySelector('button.tool-instance-id')?.textContent?.trim()).toBe(
      'adjustableBed1',
    );
    expect(rows[1].querySelector('a.placed-tool-name')?.textContent?.trim()).toBe(
      'Procedure Cart',
    );
    expect(rows[2].querySelector('.placed-tool-name')?.textContent?.trim()).toBe('nursingCart');
    expect(rows[2].querySelector('.vessel-library-badge')?.textContent?.trim()).toBe(
      'Local vessel',
    );
    expect(rows[2].querySelector('.tool-instance-id')).toBeNull();
    expect(rows[2].textContent).not.toContain('custom_vessel/inline-cart');
  });

  it('shows the runtime id inline for a single empty vessel', () => {
    const host = fixture.nativeElement as HTMLElement;
    const rows = host.querySelectorAll('.placed-tool-row');
    const bed = rows[0];
    expect(bed.querySelector('button.tool-instance-id')?.textContent).toContain('adjustableBed1');
    expect(bed.querySelector('.tool-instance-parent')).toBeNull();
    expect(bed.querySelector('.placed-tool-qty')).toBeNull();
  });

  it('collapses duplicates behind a quantity that expands to every tool id', () => {
    const host = fixture.nativeElement as HTMLElement;
    const qty = host.querySelector<HTMLButtonElement>('.placed-tool-qty')!;
    expect(qty.textContent).toContain('2');
    expect(host.querySelector('.tool-instance-list')).toBeNull();

    qty.click();
    fixture.detectChanges();

    const ids = Array.from(host.querySelectorAll('.tool-instance-list .tool-instance-id')).map(
      (el) => el.textContent?.trim(),
    );
    expect(ids).toEqual(['procedureCart1', 'procedureCart2']);
  });
});

describe('AssetDetailComponent equipment model', () => {
  let fixture: ComponentFixture<AssetDetailComponent>;
  let component: AssetDetailComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetDetailComponent],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetDetailComponent);
    component = fixture.componentInstance;
    component.asset = {
      AssetId: 'equipment-id',
      AssetName: 'Info Pamphlet',
      AssetType: 'Equipment',
      Data: { AssetKey: 'equipment_info_pamphlet' },
      Tags: [],
      _Category: 'Equipment',
      _File: 'unity',
    };
    fixture.detectChanges();
  });

  it('shows the inline viewer for addressable equipment', () => {
    expect(component.isToolLike()).toBeTrue();
    expect(component.orbitAddressable()).toBe('equipment_info_pamphlet');
    expect(component.canViewOrbit()).toBeTrue();
    expect(component.showInlineModel()).toBeTrue();
  });

  it('places the model after name, id, and tags', () => {
    const host = fixture.nativeElement as HTMLElement;
    const copy = host.querySelector('.asset-summary-copy');
    const media = host.querySelector('.asset-summary-media');
    expect(copy).toBeTruthy();
    expect(media).toBeTruthy();
    expect(
      Boolean(
        copy &&
          media &&
          copy.compareDocumentPosition(media) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBeTrue();
  });

  it('does not show Compatible Equipment', () => {
    expect(component.showCompatibleEquipment()).toBeFalse();
    expect(fixture.nativeElement.textContent).not.toContain('Compatible Equipment');
  });
});

describe('AssetDetailComponent ultrasound video', () => {
  let fixture: ComponentFixture<AssetDetailComponent>;
  let component: AssetDetailComponent;

  const videoAsset: DboAsset = {
    AssetId: 'video-1',
    AssetName: 'Abscess',
    AssetType: 'Ultrasound Video',
    Data: {
      VideoKind: 'ultrasound',
      AssetKey: 'Assets/SimX/AssetBundles/Videos/Ultrasound/Abscess/AbnormalAbscess.anim',
      Duration: 12.1,
      Fps: 10,
      Loop: true,
      FrameCount: 121,
      VideoUrl: 'db/videos/media/abscess.mp4',
      PosterUrl: 'db/videos/media/abscess.poster.jpg',
    },
    Tags: ['us_abnormal'],
    _Category: 'Videos',
    _File: 'unity',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetDetailComponent],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetDetailComponent);
    component = fixture.componentInstance;
    component.asset = videoAsset;
    fixture.detectChanges();
  });

  it('plays the encoded clip beside the summary', () => {
    expect(component.showInlineVideo()).toBeTrue();
    expect(component.videoUrl()).toBe('db/videos/media/abscess.mp4');
    expect(component.videoLoops()).toBeTrue();
    const video = (fixture.nativeElement as HTMLElement).querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('src')).toBe('db/videos/media/abscess.mp4');
    expect(video?.autoplay).toBeTrue();
    expect(video?.muted).toBeTrue();
  });

  it('omits media paths from the property table', () => {
    const keys = component.dataKeys();
    expect(keys).not.toContain('VideoUrl');
    expect(keys).not.toContain('PosterUrl');
    expect(keys).toContain('Duration');
    expect(keys).toContain('AssetKey');
  });
});

describe('AssetDetailComponent audio clip', () => {
  let fixture: ComponentFixture<AssetDetailComponent>;
  let component: AssetDetailComponent;

  const audioAsset: DboAsset = {
    AssetId: 'audio-1',
    AssetName: 'Ambient Suburban',
    AssetType: 'Sound Effect',
    Data: {
      AudioKind: 'sound-effect',
      AssetKey: 'Ambient_Suburban',
      ClipPath: 'Assets/SimX/Scenes/Environments/SimX_TrainingHouse/Audio/Ambient_Suburban.ogg',
      AudioUrl: 'db/audio/media/Ambient_Suburban.3dfe750a.ogg',
      CopyStatus: 'copied',
    },
    Tags: ['Ambient'],
    _Category: 'Audio',
    _File: 'unity',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetDetailComponent],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetDetailComponent);
    component = fixture.componentInstance;
    component.asset = audioAsset;
    fixture.detectChanges();
  });

  it('plays the copied clip beside the summary', () => {
    expect(component.showInlineAudio()).toBeTrue();
    expect(component.audioUrl()).toBe('db/audio/media/Ambient_Suburban.3dfe750a.ogg');
    const audio = (fixture.nativeElement as HTMLElement).querySelector('audio');
    expect(audio).toBeTruthy();
    expect(audio?.getAttribute('src')).toBe('db/audio/media/Ambient_Suburban.3dfe750a.ogg');
  });

  it('omits the media URL from the property table', () => {
    const keys = component.dataKeys();
    expect(keys).not.toContain('AudioUrl');
    expect(keys).toContain('ClipPath');
    expect(keys).toContain('AssetKey');
  });
});

describe('AssetDetailComponent tags', () => {
  let fixture: ComponentFixture<AssetDetailComponent>;
  let component: AssetDetailComponent;
  let http: HttpTestingController;
  let tags: TagTaxonomyService;

  const characterAsset: DboAsset = {
    AssetId: 'char-1',
    AssetName: 'Adolescent01 Base',
    AssetType: 'CharacterBase',
    Data: { AssetKey: 'character_adolescent01' },
    Tags: ['Core', 'Adolescent'],
    _Category: 'Characters',
    _File: 'unity',
  };

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AssetDetailComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    tags = TestBed.inject(TagTaxonomyService);
    http = TestBed.inject(HttpTestingController);
    const loaded = tags.ensureLoaded();
    http.expectOne('http://localhost:4301/tag-taxonomy').flush({
      categories: [],
      tags: [],
    });
    await loaded;

    fixture = TestBed.createComponent(AssetDetailComponent);
    component = fixture.componentInstance;
    component.asset = characterAsset;
    TestBed.inject(AssetMetaService).records.set({
      'char-1': {
        ...emptyAssetMetaRecord('char-1'),
        tags: ['Pediatric'],
      },
    });
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('renders scrape tags as capsules and overlay tags in a distinct style', () => {
    const host = fixture.nativeElement as HTMLElement;
    const native = Array.from(host.querySelectorAll('.asset-tag--native')).map(
      (el) => el.textContent?.replace(/\s+/g, ' ').trim(),
    );
    const meta = Array.from(host.querySelectorAll('.asset-tag--meta')).map(
      (el) => el.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(native).toEqual(['Core', 'Adolescent']);
    expect(meta).toEqual(['Pediatric']);
    expect(host.querySelector('.tag-add-btn')).toBeNull();
  });

  it('lets an editor add overlay tags with the plus button', async () => {
    const meta = TestBed.inject(AssetMetaService);
    meta.setCanEdit(true);
    spyOn(meta, 'saveRecord').and.resolveTo({
      ...emptyAssetMetaRecord('char-1'),
      tags: ['Pediatric', 'Military'],
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('.tag-add-btn')!.click();
    fixture.detectChanges();

    component.tagDraft.set('Military');
    await component.commitTagDraft();
    fixture.detectChanges();

    expect(meta.saveRecord).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Military');
    expect(host.querySelector('.header-edit-actions')).toBeTruthy();

    host.querySelector<HTMLButtonElement>('.header-edit-actions .simx-btn--primary')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(meta.saveRecord).toHaveBeenCalledWith('char-1', jasmine.objectContaining({
      tags: ['Pediatric', 'Military'],
    }));
  });

  it('discards overlay tag edits without writing the record', async () => {
    const meta = TestBed.inject(AssetMetaService);
    meta.setCanEdit(true);
    spyOn(meta, 'saveRecord');
    fixture.detectChanges();

    await component.addMetaTag('Military');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Military');
    host.querySelector<HTMLButtonElement>('.header-edit-actions .simx-btn:not(.simx-btn--primary)')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(meta.saveRecord).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Military');
    expect(host.querySelector('.header-edit-actions')).toBeNull();
  });

  it('registers a new overlay tag in the Custom category', async () => {
    const meta = TestBed.inject(AssetMetaService);
    meta.setCanEdit(true);

    const adding = component.addMetaTag('Needs Review');
    const req = http.expectOne(
      (r) => r.method === 'PUT' && r.url === 'http://localhost:4301/tag-taxonomy',
    );
    expect(
      req.request.body.tags.map((t: { label: string }) => t.label),
    ).toContain('Needs Review');
    req.flush(req.request.body);
    await adding;

    expect(
      tags.tagsForCategory(CUSTOM_TAG_CATEGORY_ID).map((t) => t.label),
    ).toContain('Needs Review');
    expect(
      tags.tagsAvailableForAssetType('Characters').map((t) => t.label),
    ).toContain('Needs Review');
  });
});
