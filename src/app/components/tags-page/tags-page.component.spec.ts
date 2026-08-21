import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { GLOBAL_TAG_CATEGORY_ID } from '../../models/tag.models';
import { TagTaxonomyService } from '../../services/tag-taxonomy.service';
import { TagsPageComponent } from './tags-page.component';

describe('TagsPageComponent', () => {
  let fixture: ComponentFixture<TagsPageComponent>;
  let service: TagTaxonomyService;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TagsPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    service = TestBed.inject(TagTaxonomyService);
    http = TestBed.inject(HttpTestingController);
    const loaded = service.ensureLoaded();
    http.expectOne('http://localhost:4301/tag-taxonomy').flush({
      categories: [],
      tags: [],
    });
    await loaded;

    fixture = TestBed.createComponent(TagsPageComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('surfaces Global and Custom separately from asset type groups', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Global');
    expect(text).toContain('Custom');
    expect(text).toContain('All types');
    expect(text).toContain('Asset types');
    expect(text).toContain('Tooling');
    expect(text).toContain('Characters');
    expect(text).toContain(
      'These tags can be applied and accepted on any asset type.',
    );
  });

  it('shows type-only copy when a type group is selected', () => {
    const buttons = fixture.debugElement.queryAll(By.css('.nav-item'));
    const tooling = buttons.find((b) =>
      (b.nativeElement as HTMLElement).textContent?.includes('Tooling'),
    );
    expect(tooling).toBeTruthy();
    tooling!.nativeElement.click();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('These tags apply only to Tooling assets.');
    expect(text).toContain('Grabbable');
    expect(text).toContain('Scraped');
    expect(fixture.componentInstance.selectedId()).not.toBe(
      GLOBAL_TAG_CATEGORY_ID,
    );
  });

  it('describes Custom as overlay tags that apply to any type', () => {
    const buttons = fixture.debugElement.queryAll(By.css('.nav-item'));
    const custom = buttons.find((b) =>
      (b.nativeElement as HTMLElement).textContent?.includes('Custom'),
    );
    expect(custom).toBeTruthy();
    custom!.nativeElement.click();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain(
      'These tags come from asset metadata overlays and can be applied to any asset type.',
    );
  });
});
