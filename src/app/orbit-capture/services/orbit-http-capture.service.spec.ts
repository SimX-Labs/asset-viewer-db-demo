import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  OrbitHttpCaptureService,
  OrbitModelsRoot,
} from './orbit-http-capture.service';

function rootInfo(dir: string): OrbitModelsRoot {
  return {
    dir,
    count: 12,
    usingStaleCopy: dir.includes('public'),
    staleHint: dir.includes('public') ? 'stale copy' : null,
    suggestions: [],
  };
}

describe('OrbitHttpCaptureService', () => {
  let http: HttpTestingController;
  let service: OrbitHttpCaptureService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrbitHttpCaptureService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the current models folder from the API', async () => {
    const pending = service.loadRoot();
    const req = http.expectOne('http://localhost:4301/models-root');
    expect(req.request.method).toBe('GET');
    req.flush(rootInfo('C:\\SimX\\Custom\\asset-viewer-db\\public\\models'));
    const info = await pending;
    expect(info.count).toBe(12);
    expect(service.root()?.usingStaleCopy).toBeTrue();
  });

  it('remounts the models folder and bumps the reload revision', async () => {
    expect(service.rootRevision()).toBe(0);
    const pending = service.setRoot(
      'C:\\SimX\\unity-env-authoring\\OrbitCaptures\\EXPORT',
    );
    const req = http.expectOne('http://localhost:4301/models-root');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      dir: 'C:\\SimX\\unity-env-authoring\\OrbitCaptures\\EXPORT',
    });
    req.flush(
      rootInfo('C:\\SimX\\unity-env-authoring\\OrbitCaptures\\EXPORT'),
    );
    const info = await pending;
    expect(info.usingStaleCopy).toBeFalse();
    expect(service.rootRevision()).toBe(1);
    expect(service.root()?.dir).toContain('OrbitCaptures');
  });
});
