import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageLightboxComponent } from './image-lightbox.component';

describe('ImageLightboxComponent', () => {
  let fixture: ComponentFixture<ImageLightboxComponent>;

  const urls = ['a.jpg', 'b.jpg', 'c.jpg'];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageLightboxComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ImageLightboxComponent);
    fixture.componentRef.setInput('urls', urls);
    fixture.componentRef.setInput('index', 1);
    fixture.detectChanges();
  });

  it('shows faded neighbor images around the selected slide', () => {
    const host = fixture.nativeElement as HTMLElement;
    const peeks = host.querySelectorAll('.lightbox-peek img');
    expect(peeks.length).toBe(2);
    expect(peeks[0].getAttribute('src')).toBe('a.jpg');
    expect(peeks[1].getAttribute('src')).toBe('c.jpg');
    expect(host.querySelector('.lightbox-image')?.getAttribute('src')).toBe('b.jpg');
    expect(host.querySelector('.lightbox-counter')?.textContent?.trim()).toBe('2 / 3');
  });

  it('advances from a neighbor peek and from arrow keys', () => {
    const host = fixture.nativeElement as HTMLElement;
    const nextPeek = host.querySelector('.lightbox-peek--next') as HTMLButtonElement;
    nextPeek.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.index).toBe(2);
    expect(host.querySelector('.lightbox-image')?.getAttribute('src')).toBe('c.jpg');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.index).toBe(0);
    expect(host.querySelector('.lightbox-peek--prev img')?.getAttribute('src')).toBe('c.jpg');
    expect(host.querySelector('.lightbox-peek--next img')?.getAttribute('src')).toBe('b.jpg');
  });

  it('hides neighbor peeks for a single image', () => {
    fixture.componentRef.setInput('urls', ['only.jpg']);
    fixture.componentRef.setInput('index', 0);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.lightbox-peek')).toBeNull();
    expect(host.querySelector('.lightbox-nav')).toBeNull();
  });
});
