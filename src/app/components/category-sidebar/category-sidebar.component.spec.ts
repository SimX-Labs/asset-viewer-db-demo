import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { CategorySidebarComponent } from './category-sidebar.component';

describe('CategorySidebarComponent', () => {
  let fixture: ComponentFixture<CategorySidebarComponent>;

  beforeEach(async () => {
    localStorage.removeItem('asset-viewer.categories-open');
    await TestBed.configureTestingModule({
      imports: [CategorySidebarComponent],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(CategorySidebarComponent);
    fixture.detectChanges();
  });

  it('toggles collapse from the foldout control', () => {
    const host = fixture.nativeElement as HTMLElement;
    const toggle = host.querySelector('.sidebar-toggle') as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    expect(host.classList.contains('collapsed')).toBeFalse();
    expect(host.querySelector('.panel-header')?.textContent?.trim()).toBe('Categories');

    toggle.click();
    fixture.detectChanges();
    expect(host.classList.contains('collapsed')).toBeTrue();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('.sidebar-body')).toBeTruthy();
  });
});
