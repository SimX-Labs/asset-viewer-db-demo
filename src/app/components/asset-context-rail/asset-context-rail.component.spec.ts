import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AssetContextRailComponent } from './asset-context-rail.component';
import { DboAsset } from '../../models/dbo.models';

describe('AssetContextRailComponent', () => {
  let fixture: ComponentFixture<AssetContextRailComponent>;

  const toolAsset: DboAsset = {
    AssetId: 'tool-1',
    AssetName: 'Pillow',
    AssetType: 'Tool',
    Data: {
      AssetKey: 'tool_pillow',
      CreatedBy: 'Jason Ribeira <jason@simx.com>',
      CreatedOn: '2020-08-09',
      LastUpdatedBy: 'alex.brandt <alex.brandt@simxvr.com>',
      LastUpdatedOn: '2026-02-04',
      Contributors: [
        { Name: 'alex.brandt <alex.brandt@simxvr.com>', Commits: 14 },
        { Name: 'Caolan <caolan@simx.com>', Commits: 8 },
        { Name: 'pfmallon <pfmallon@simx.com>', Commits: 3 },
      ],
      ContributorOtherCommits: 6,
    },
    Tags: [],
    _Category: 'Tooling',
    _File: 'unity',
  };

  beforeEach(async () => {
    localStorage.removeItem('asset-viewer.context-open');
    await TestBed.configureTestingModule({
      imports: [AssetContextRailComponent],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(AssetContextRailComponent);
    fixture.componentInstance.asset = toolAsset;
    fixture.detectChanges();
  });

  it('renders creator and top contributors with emails on hover', () => {
    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';
    expect(host.querySelector('.git-authorship-heading')?.textContent?.trim()).toBe(
      'Contributors',
    );
    expect(text).toContain('created');
    expect(text).toContain('Jason Ribeira');
    expect(text).toContain('2020-08-09');
    expect(text).toContain('updated');
    expect(text).toContain('alex.brandt');
    expect(text).toContain('2026-02-04');
    expect(text).toContain('Caolan');
    expect(text).not.toContain('[14]');
    expect(text).not.toContain('[8]');
    expect(text).not.toContain('jason@simx.com');
    expect(text).not.toContain('alex.brandt@simxvr.com');

    const titles = Array.from(host.querySelectorAll('.git-person, .contrib-name')).map(
      (el) => el.getAttribute('title') ?? '',
    );
    expect(titles).toContain('jason@simx.com');
    expect(titles.some((t) => t.includes('14 Commits') && t.includes('alex.brandt@simxvr.com'))).toBeTrue();
    expect(titles.some((t) => t.includes('8 Commits') && t.includes('caolan@simx.com'))).toBeTrue();
    expect(titles.some((t) => t.includes('3 Commits') && t.includes('pfmallon@simx.com'))).toBeTrue();
    const legend = Array.from(host.querySelectorAll('.contrib-legend-item')) as HTMLElement[];
    expect(legend.map((el) => el.style.color)).toEqual([
      'var(--contributor-slice-1)',
      'var(--contributor-slice-2)',
      'var(--contributor-slice-3)',
    ]);
    const wedges = host.querySelectorAll('.contrib-pie path');
    expect(wedges.length).toBe(4);
    expect(host.querySelectorAll('.contrib-legend-item').length).toBe(3);
    expect(host.querySelector('.contrib-pie-tip')).toBeNull();
    wedges[0].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    fixture.detectChanges();
    expect(host.querySelector('.contrib-pie-tip')?.textContent?.trim()).toBe('14 Commits');
  });

  it('keeps comments in the rail', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.comments-title')?.textContent?.trim()).toBe('Comments');
  });

  it('toggles collapse from the foldout control', () => {
    const host = fixture.nativeElement as HTMLElement;
    const toggle = host.querySelector('.context-toggle') as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    expect(host.classList.contains('collapsed')).toBeFalse();

    toggle.click();
    fixture.detectChanges();
    expect(host.classList.contains('collapsed')).toBeTrue();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
