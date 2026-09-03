import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AssetMetaPanelComponent } from './asset-meta-panel.component';
import { AssetMetaService } from '../../services/asset-meta.service';
import { emptyAssetMetaRecord } from '../../models/asset-meta.models';
import { DboAsset } from '../../models/dbo.models';

describe('AssetMetaPanelComponent comments', () => {
  let fixture: ComponentFixture<AssetMetaPanelComponent>;
  let meta: AssetMetaService;

  const assetA: DboAsset = {
    AssetId: 'asset-a',
    AssetName: 'Board A',
    AssetType: 'Equipment',
    Data: {},
  };
  const assetB: DboAsset = {
    AssetId: 'asset-b',
    AssetName: 'Board B',
    AssetType: 'Equipment',
    Data: {},
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetMetaPanelComponent],
      providers: [provideHttpClient()],
    }).compileComponents();

    meta = TestBed.inject(AssetMetaService);
    const a = emptyAssetMetaRecord('asset-a');
    a.comments = [
      {
        id: 'c1',
        body: 'Comment on A',
        createdAt: '2026-01-01T00:00:00.000Z',
        author: { sub: 'user-a', name: 'Alice' },
      },
    ];
    const b = emptyAssetMetaRecord('asset-b');
    b.comments = [
      {
        id: 'c2',
        body: 'Comment on B',
        createdAt: '2026-01-02T00:00:00.000Z',
        author: { sub: 'user-b', name: 'Bob' },
      },
    ];
    meta.records.set({ 'asset-a': a, 'asset-b': b });

    fixture = TestBed.createComponent(AssetMetaPanelComponent);
    fixture.componentRef.setInput('showNotes', false);
    fixture.componentRef.setInput('asset', assetA);
    fixture.detectChanges();
  });

  it('replaces comments when the open asset changes', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Comment on A');
    expect(host.textContent).not.toContain('Comment on B');

    fixture.componentRef.setInput('asset', assetB);
    fixture.detectChanges();

    expect(host.textContent).toContain('Comment on B');
    expect(host.textContent).not.toContain('Comment on A');
  });
});

describe('AssetMetaPanelComponent notes status', () => {
  let fixture: ComponentFixture<AssetMetaPanelComponent>;
  let meta: AssetMetaService;

  const asset: DboAsset = {
    AssetId: 'asset-notes',
    AssetName: 'Board',
    AssetType: 'Equipment',
    Data: {},
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetMetaPanelComponent],
      providers: [provideHttpClient()],
    }).compileComponents();

    meta = TestBed.inject(AssetMetaService);
    const record = emptyAssetMetaRecord('asset-notes');
    record.status = 'Functional';
    meta.records.set({ 'asset-notes': record });
    meta.canEditMeta.set(true);

    fixture = TestBed.createComponent(AssetMetaPanelComponent);
    fixture.componentRef.setInput('showComments', false);
    fixture.componentRef.setInput('asset', asset);
    fixture.detectChanges();
  });

  it('shows a color-coded status picker and Add Note', () => {
    const host = fixture.nativeElement as HTMLElement;
    const chip = host.querySelector('.status-chip') as HTMLElement;
    expect(chip.getAttribute('data-status')).toBe('Functional');
    expect(host.textContent).toContain('Add Note');
    expect(host.textContent).not.toContain('Add notes');

    chip.click();
    fixture.detectChanges();
    const options = Array.from(host.querySelectorAll('.status-option')) as HTMLElement[];
    expect(options.map((el) => el.getAttribute('data-status'))).toEqual([
      'unset',
      'Development',
      'Functional',
      'Stable',
      'Deprecated',
    ]);
  });

  it('adds a note to the draft without saving immediately', () => {
    spyOn(meta, 'saveRecord');
    const host = fixture.nativeElement as HTMLElement;
    const add = Array.from(host.querySelectorAll('button')).find((el) =>
      el.textContent?.includes('Add Note'),
    ) as HTMLButtonElement;
    add.click();
    fixture.detectChanges();
    const markdown = Array.from(host.querySelectorAll('button')).find((el) =>
      el.textContent?.includes('Markdown'),
    ) as HTMLButtonElement;
    markdown.click();
    fixture.detectChanges();

    expect(meta.saveRecord).not.toHaveBeenCalled();
    expect(meta.isDirty('asset-notes')).toBeTrue();
    expect(host.querySelector('.edit-block')).toBeTruthy();
    expect(host.querySelector('.meta-panel-actions')).toBeNull();
  });

  it('keeps a status change in the draft until the asset is saved', () => {
    spyOn(meta, 'saveRecord');
    const host = fixture.nativeElement as HTMLElement;
    (host.querySelector('.status-chip') as HTMLElement).click();
    fixture.detectChanges();
    const stable = Array.from(host.querySelectorAll('.status-option')).find(
      (el) => el.getAttribute('data-status') === 'Stable',
    ) as HTMLElement;
    stable.click();
    fixture.detectChanges();

    expect(meta.saveRecord).not.toHaveBeenCalled();
    expect(meta.isDirty('asset-notes')).toBeTrue();
    expect(meta.effectiveStatus('asset-notes')).toBe('Stable');
    expect((host.querySelector('.status-chip') as HTMLElement).getAttribute('data-status')).toBe(
      'Stable',
    );
  });

  it('asks before clearing metadata', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    spyOn(meta, 'clearRecord').and.resolveTo();
    const host = fixture.nativeElement as HTMLElement;
    const clear = Array.from(host.querySelectorAll('button')).find((el) =>
      el.textContent?.includes('Clear metadata'),
    ) as HTMLButtonElement;
    expect(clear).toBeTruthy();
    clear.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(window.confirm).toHaveBeenCalled();
    expect(meta.clearRecord).toHaveBeenCalledWith('asset-notes');
  });

  it('keeps Add Note on the left of the notes header', () => {
    const host = fixture.nativeElement as HTMLElement;
    const head = host.querySelector('.notes-head') as HTMLElement;
    const children = Array.from(head.children);
    expect(children[0].textContent).toContain('Notes');
    expect(children[1].textContent).toContain('Add Note');
  });

  it('offers a video note type', () => {
    const host = fixture.nativeElement as HTMLElement;
    const add = Array.from(host.querySelectorAll('button')).find((el) =>
      el.textContent?.includes('Add Note'),
    ) as HTMLButtonElement;
    add.click();
    fixture.detectChanges();

    const labels = Array.from(host.querySelectorAll('.add-block-row button')).map((el) =>
      el.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(labels).toContain('Video');
    expect(labels).toContain('Markdown');
  });

  it('shows a markdown preview and formatting toolbar while editing', () => {
    const host = fixture.nativeElement as HTMLElement;
    const add = Array.from(host.querySelectorAll('button')).find((el) =>
      el.textContent?.includes('Add Note'),
    ) as HTMLButtonElement;
    add.click();
    fixture.detectChanges();
    const markdown = Array.from(host.querySelectorAll('button')).find((el) =>
      el.textContent?.includes('Markdown'),
    ) as HTMLButtonElement;
    markdown.click();
    fixture.detectChanges();

    expect(host.querySelector('.md-toolbar')).toBeTruthy();
    expect(host.querySelector('.md-style')).toBeTruthy();
    expect(host.querySelector('.md-preview--empty')?.textContent).toContain('Nothing to preview');

    const textarea = host.querySelector('.md-input') as HTMLTextAreaElement;
    textarea.value = '**Hello**';
    textarea.setSelectionRange(0, 9);
    fixture.componentInstance.applyMarkdownInline(textarea, '*', '*');
    fixture.detectChanges();

    expect(host.querySelector('.md-preview')?.innerHTML).toContain('Hello');
    expect(host.querySelector('.md-preview--empty')).toBeNull();
  });
});

describe('AssetMetaPanelComponent carousel', () => {
  let fixture: ComponentFixture<AssetMetaPanelComponent>;

  const asset: DboAsset = {
    AssetId: 'asset-carousel',
    AssetName: 'Board',
    AssetType: 'Equipment',
    Data: {},
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssetMetaPanelComponent],
      providers: [provideHttpClient()],
    }).compileComponents();

    const meta = TestBed.inject(AssetMetaService);
    const record = emptyAssetMetaRecord('asset-carousel');
    record.notes = [
      {
        id: 'car-1',
        type: 'carousel',
        mediaIds: ['m1', 'm2', 'm3'],
        slideCaptions: { m1: 'First', m2: 'Second', m3: 'Third' },
      },
    ];
    record.media = [
      { id: 'm1', filename: 'one.jpg', contentType: 'image/jpeg' },
      { id: 'm2', filename: 'two.jpg', contentType: 'image/jpeg' },
      { id: 'm3', filename: 'three.jpg', contentType: 'image/jpeg' },
    ];
    meta.records.set({ 'asset-carousel': record });

    fixture = TestBed.createComponent(AssetMetaPanelComponent);
    fixture.componentRef.setInput('showComments', false);
    fixture.componentRef.setInput('asset', asset);
    fixture.detectChanges();
  });

  it('shows the selected image above a horizontal strip of slides', () => {
    const host = fixture.nativeElement as HTMLElement;
    const thumbs = host.querySelectorAll('.carousel-strip-item');
    expect(thumbs.length).toBe(3);
    expect(thumbs[0].classList.contains('active')).toBeTrue();
    expect(host.querySelector('.carousel-hero img')?.getAttribute('src')).toContain('one.jpg');
    expect(host.textContent).toContain('1 / 3');
    expect(host.textContent).toContain('First');

    (thumbs[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(thumbs[1].classList.contains('active')).toBeTrue();
    expect(host.querySelector('.carousel-hero img')?.getAttribute('src')).toContain('two.jpg');
    expect(host.textContent).toContain('2 / 3');
    expect(host.textContent).toContain('Second');
  });
});
