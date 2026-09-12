import { HttpClient, HttpContext, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { Observable, catchError, of, shareReplay, switchMap, throwError } from 'rxjs';
import { RUNTIME_CONFIG } from '../runtime';
import { API_ROUTES } from '../api/api-routes';

/**
 * Transport boundary for the future API. Feature code depends on repositories,
 * never on HttpClient or endpoint strings. The demo remains the active provider.
 */
export interface ApiRequest<TBody = unknown> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: TBody;
  params?: Readonly<Record<string, string | number | boolean | undefined>>;
}

export interface ApiTransport {
  request<TResponse, TBody = unknown>(request: ApiRequest<TBody>): Observable<TResponse>;
}

export const API_TRANSPORT = new InjectionToken<ApiTransport>('API_TRANSPORT');

export interface ApiProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ApiProblem,
  ) {
    super(problem.detail || problem.title || `La API respondió ${status}.`);
  }
}

/**
 * Transporte HTTP con token CSRF cacheado.
 *
 * Antes se pedía un token nuevo antes de cada escritura y el servidor rotaba la
 * cookie en cada llamada: dos escrituras concurrentes se anulaban entre sí
 * (A obtiene T1, B obtiene T2 y sobreescribe la cookie, A envía T1 → 403), y
 * toda mutación pagaba una ida y vuelta extra. Ahora el token se pide una vez,
 * se comparte entre peticiones en vuelo y sólo se renueva cuando el servidor lo
 * rechaza con `security.csrf_invalid`.
 */
@Injectable()
export class HttpApiTransport implements ApiTransport {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  private csrfToken: string | null = null;
  private csrfInFlight: Observable<string> | null = null;

  request<TResponse, TBody = unknown>(request: ApiRequest<TBody>): Observable<TResponse> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(request.params ?? {})) {
      if (value !== undefined) params = params.set(key, String(value));
    }
    if (this.config.mode !== 'api' || !this.config.apiBaseUrl)
      return throwError(() => new Error('El transporte HTTP no está activo en modo demo.'));

    const unsafe = request.method !== 'GET';
    const send = (csrfToken?: string) => {
      let headers = new HttpHeaders({ Accept: 'application/json' });
      if (csrfToken) headers = headers.set('X-CSRF-Token', csrfToken);
      return this.http.request<TResponse>(request.method, `${this.config.apiBaseUrl}${request.path}`, {
        body: request.body,
        params,
        headers,
        context: new HttpContext(),
        withCredentials: true,
      });
    };

    const response$ = unsafe
      ? this.csrf().pipe(
          switchMap((token) =>
            send(token).pipe(
              catchError((error: HttpErrorResponse) =>
                this.isStaleCsrf(error)
                  ? this.csrf(true).pipe(switchMap((renewed) => send(renewed)))
                  : throwError(() => error),
              ),
            ),
          ),
        )
      : send();

    return response$.pipe(
      catchError((error: HttpErrorResponse) =>
        throwError(() => new ApiRequestError(error.status, (error.error ?? {}) as ApiProblem)),
      ),
    );
  }

  /** Descarta el token en memoria. La sesión nueva traerá el suyo. */
  forgetCsrfToken(): void {
    this.csrfToken = null;
    this.csrfInFlight = null;
  }

  private csrf(renew = false): Observable<string> {
    if (renew) this.forgetCsrfToken();
    if (this.csrfToken) return of(this.csrfToken);
    if (this.csrfInFlight) return this.csrfInFlight;

    this.csrfInFlight = this.http
      .get<{ token: string }>(`${this.config.apiBaseUrl}${API_ROUTES.csrf}`, { withCredentials: true })
      .pipe(
        switchMap(({ token }) => {
          this.csrfToken = token;
          this.csrfInFlight = null;
          return of(token);
        }),
        catchError((error) => {
          this.csrfInFlight = null;
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
    return this.csrfInFlight;
  }

  private isStaleCsrf(error: HttpErrorResponse): boolean {
    return error.status === 403 && (error.error as ApiProblem | null)?.code === 'security.csrf_invalid';
  }
}
