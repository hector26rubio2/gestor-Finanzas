import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_TRANSPORT, FinanceApiClient, HttpApiTransport } from './api-client';
import { RUNTIME_CONFIG } from './runtime';

describe('FinanceApiClient', () => {
  let api: FinanceApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { mode: 'api', apiBaseUrl: 'https://api.example.test' } },
        { provide: API_TRANSPORT, useClass: HttpApiTransport },
      ],
    });
    api = TestBed.inject(FinanceApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests the stable session endpoint with credentials', async () => {
    const promise = firstValueFrom(api.session());
    const request = http.expectOne('https://api.example.test/api/v1/session');
    expect(request.request.withCredentials).toBe(true);
    request.flush({
      user: { id: '1', displayName: 'Demo', email: 'demo@example.test', isActive: true },
      organization: { id: '2', name: 'Personal', slug: 'personal', baseCurrency: 'COP', isActive: true, createdAt: '' },
      capabilities: [1],
      organizations: [],
      expiresAt: '',
    });
    expect((await promise).user.displayName).toBe('Demo');
  });

  it('obtains a CSRF token before the first unsafe request', async () => {
    const movementsPromise = firstValueFrom(api.movements({ page: 1, pageSize: 10 }));
    const csrf = http.expectOne('https://api.example.test/api/v1/auth/csrf');
    expect(csrf.request.withCredentials).toBe(true);
    csrf.flush({ token: 'once' });
    const request = http.expectOne('https://api.example.test/api/v1/movements/search');
    expect(request.request.headers.get('X-CSRF-Token')).toBe('once');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body.page).toEqual({ page: 1, size: 10 });
    request.flush({ items: [], page: 1, size: 10, total: 0, totalPages: 0, hasNext: false });
    expect((await movementsPromise).items).toEqual([]);
  });

  it('keeps API problem details instead of falling back to demo data', async () => {
    const promise = firstValueFrom(api.session());
    http
      .expectOne('https://api.example.test/api/v1/session')
      .flush(
        { title: 'Sesión requerida', detail: 'La cookie expiró.', code: 'authentication.required' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await expect(promise).rejects.toMatchObject({
      status: 401,
      message: 'La cookie expiró.',
      problem: { code: 'authentication.required' },
    });
  });

  it('uses the published calendar query contract', async () => {
    const promise = firstValueFrom(api.projectedCalendar('2026-09-01', '2026-09-30'));
    const request = http.expectOne(
      (candidate) =>
        candidate.url === 'https://api.example.test/api/v1/calendar/projected' &&
        candidate.params.get('from') === '2026-09-01' &&
        candidate.params.get('to') === '2026-09-30',
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
    expect(await promise).toEqual([]);
  });

  it('sends notification state changes through the CSRF-protected route', async () => {
    const promise = firstValueFrom(api.markNotificationRead('notice-1', false));
    http.expectOne('https://api.example.test/api/v1/auth/csrf').flush({ token: 'csrf' });
    const request = http.expectOne('https://api.example.test/api/v1/notifications/notice-1/read');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ isRead: false });
    request.flush({ id: 'notice-1', kind: 'test', title: 'Aviso', payloadJson: '{}', readAt: null, createdAt: '' });
    expect((await promise).readAt).toBeNull();
  });

  it('encodes feature flag keys in the administration route', async () => {
    const promise = firstValueFrom(api.updateFeatureFlag('planning/simulator', { isEnabled: true }));
    http.expectOne('https://api.example.test/api/v1/auth/csrf').flush({ token: 'csrf' });
    const request = http.expectOne('https://api.example.test/api/v1/admin/feature-flags/planning%2Fsimulator');
    expect(request.request.body).toEqual({ isEnabled: true });
    request.flush({ key: 'planning/simulator', isEnabled: true, audienceJson: null, updatedAt: '' });
    expect((await promise).isEnabled).toBe(true);
  });

  it('uses immutable ledger correction routes', async () => {
    const reclassify = firstValueFrom(
      api.reclassifyMovement('movement-1', { category: 'category-2', description: 'Corregido' }),
    );
    http.expectOne('https://api.example.test/api/v1/auth/csrf').flush({ token: 'csrf-1' });
    const classification = http.expectOne('https://api.example.test/api/v1/movements/movement-1/classification');
    expect(classification.request.method).toBe('PUT');
    expect(classification.request.body).toEqual({ category: 'category-2', description: 'Corregido' });
    classification.flush({ id: 'movement-1' });
    await reclassify;

    // Sin pedir un token nuevo: el de la escritura anterior sigue vigente.
    const reversal = firstValueFrom(api.reverseMovement('movement-1', { date: '2026-09-05', reason: 'Duplicado' }));
    const request = http.expectOne('https://api.example.test/api/v1/movements/movement-1/reversal');
    expect(request.request.headers.get('X-CSRF-Token')).toBe('csrf-1');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ date: '2026-09-05', reason: 'Duplicado' });
    request.flush({ id: 'reversal-1' });
    await reversal;
  });

  it('reuses the CSRF token instead of rotating it on every write', async () => {
    // El servidor reescribía la cookie en cada GET /csrf: dos escrituras
    // concurrentes se anulaban entre sí y toda mutación pagaba una ida y vuelta.
    const first = firstValueFrom(api.createPerson({ displayName: 'Ana' }));
    http.expectOne('https://api.example.test/api/v1/auth/csrf').flush({ token: 'unico' });
    const firstRequest = http.expectOne('https://api.example.test/api/v1/people');
    expect(firstRequest.request.headers.get('X-CSRF-Token')).toBe('unico');
    firstRequest.flush({ id: 'p-1', displayName: 'Ana' });
    await first;

    const second = firstValueFrom(api.createPerson({ displayName: 'Beto' }));
    const secondRequest = http.expectOne('https://api.example.test/api/v1/people');
    expect(secondRequest.request.headers.get('X-CSRF-Token')).toBe('unico');
    secondRequest.flush({ id: 'p-2', displayName: 'Beto' });
    await second;
  });

  it('renews the CSRF token only when the server rejects it', async () => {
    const first = firstValueFrom(api.createPerson({ displayName: 'Ana' }));
    http.expectOne('https://api.example.test/api/v1/auth/csrf').flush({ token: 'viejo' });
    http.expectOne('https://api.example.test/api/v1/people').flush({ id: 'p-1', displayName: 'Ana' });
    await first;

    const retried = firstValueFrom(api.createPerson({ displayName: 'Beto' }));
    http
      .expectOne('https://api.example.test/api/v1/people')
      .flush({ code: 'security.csrf_invalid' }, { status: 403, statusText: 'Forbidden' });
    http.expectOne('https://api.example.test/api/v1/auth/csrf').flush({ token: 'nuevo' });
    const replay = http.expectOne('https://api.example.test/api/v1/people');
    expect(replay.request.headers.get('X-CSRF-Token')).toBe('nuevo');
    replay.flush({ id: 'p-2', displayName: 'Beto' });
    expect((await retried).id).toBe('p-2');
  });

  it('does not retry a forbidden response that is not a stale CSRF token', async () => {
    const promise = firstValueFrom(api.createPerson({ displayName: 'Ana' }));
    http.expectOne('https://api.example.test/api/v1/auth/csrf').flush({ token: 'vigente' });
    http
      .expectOne('https://api.example.test/api/v1/people')
      .flush({ code: 'authorization.denied' }, { status: 403, statusText: 'Forbidden' });
    await expect(promise).rejects.toMatchObject({ status: 403 });
  });

  it('materializes projected recurrences explicitly', async () => {
    const promise = firstValueFrom(
      api.materializeRecurrence('recurrence-1', { occurrence: '2026-09-08', idempotencyKey: 'retry-safe' }),
    );
    http.expectOne('https://api.example.test/api/v1/auth/csrf').flush({ token: 'csrf' });
    const request = http.expectOne('https://api.example.test/api/v1/recurrences/recurrence-1/materializations');
    expect(request.request.body).toEqual({ occurrence: '2026-09-08', idempotencyKey: 'retry-safe' });
    request.flush({ occurrence: '2026-09-08', operation: null, movements: ['movement-1'] });
    expect((await promise).movements).toEqual(['movement-1']);
  });
});
