import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AssetDetailComponent } from './asset-detail.component';
import { DboAsset } from '../../models/dbo.models';
import { AppStateService } from '../../services/app-state.service';
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
    // Skip inline GLB path; composition sections do not need Unity mode.
    TestBed.inject(AppStateService).dataMode.set('dbo');
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
    const tag = host.querySelector('.source-tag');
    expect(tag?.textContent?.trim()).toBe('Shared library git');
    expect(tag?.getAttribute('data-source')).toBe('shared-library-git');
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
      TestBed.inject(AppStateService).dataMode.set('unity');
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
    state.dataMode.set('unity');
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
    expect(labels).toEqual(['Source', 'Authoring Id', 'Last Saved']);
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
    TestBed.inject(AppStateService).dataMode.set('unity');
    fixture.detectChanges();
  });

  it('shows the inline viewer for addressable equipment', () => {
    expect(component.isToolLike()).toBeTrue();
    expect(component.orbitAddressable()).toBe('equipment_info_pamphlet');
    expect(component.canViewOrbit()).toBeTrue();
    expect(component.showInlineModel()).toBeTrue();
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
    TestBed.inject(AppStateService).dataMode.set('unity');
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
