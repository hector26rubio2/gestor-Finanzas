import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, from, of, switchMap, tap, throwError } from 'rxjs';
import { ApiWritesBus } from '@core/api/api-writes';
import { RUNTIME_CONFIG } from '@core/session/runtime';
import { AppStore } from '@core/state/store';
import {
  CABECERA_CIFRADO,
  CODIGO_LLAVE_VIEJA,
  CifradoService,
  RUTA_LLAVE_PUBLICA,
  TIPO_CIFRADO,
  esSobre,
} from './cifrado';

export const BANDERA_CIFRADO = 'security.payloadEncryption';

const esConsultaPorPost = (url: string) => /\/search(\?|$)/.test(url);

export const esEscritura = (metodo: string, url = '') =>
  metodo !== 'GET' && metodo !== 'HEAD' && metodo !== 'OPTIONS' && !esConsultaPorPost(url);

export const escriturasInterceptor: HttpInterceptorFn = (req, next) => {
  const bus = inject(ApiWritesBus);
  return next(req).pipe(
    tap((evento) => {
      if (evento instanceof HttpResponse && esEscritura(req.method, req.url)) bus.notify();
    }),
  );
};

export const cifradoInterceptor: HttpInterceptorFn = (req, next) => {
  const config = inject(RUNTIME_CONFIG);
  const store = inject(AppStore);
  const cifrado = inject(CifradoService);
  const aplica =
    !!config.apiBaseUrl &&
    req.url.startsWith(config.apiBaseUrl) &&
    !req.url.endsWith(RUTA_LLAVE_PUBLICA) &&
    (!store.featureFlagsLoaded() || store.featureFlags()[BANDERA_CIFRADO] === true);
  if (!aplica) return next(req);

  const enviar = (renovar: boolean): Observable<HttpEvent<unknown>> =>
    from(cifrado.preparar(req.body, renovar).catch(() => null)).pipe(
      switchMap((preparada) => {
        if (!preparada) {
          if (!store.featureFlagsLoaded()) return next(req);
          return throwError(
            () => new HttpErrorResponse({ status: 0, statusText: 'cifrado.no_disponible', url: req.url }),
          );
        }
        const { cabecera, cuerpo, llave } = preparada;
        const cifrada: HttpRequest<unknown> =
          cuerpo === null
            ? req.clone({ setHeaders: { [CABECERA_CIFRADO]: cabecera } })
            : req.clone({ body: cuerpo, setHeaders: { [CABECERA_CIFRADO]: cabecera, 'Content-Type': TIPO_CIFRADO } });
        return next(cifrada).pipe(
          switchMap((evento) =>
            evento instanceof HttpResponse && esSobre(evento.body)
              ? from(cifrado.abrir(evento.body, llave)).pipe(
                  switchMap((cuerpoAbierto) => of(evento.clone({ body: cuerpoAbierto }))),
                )
              : of(evento),
          ),
          catchError((error: unknown) => {
            if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
            if (
              !renovar &&
              error.status === 409 &&
              (error.error as { code?: string } | null)?.code === CODIGO_LLAVE_VIEJA
            )
              return enviar(true);
            if (!esSobre(error.error)) return throwError(() => error);
            return from(cifrado.abrir(error.error, llave)).pipe(
              switchMap((detalle) =>
                throwError(
                  () =>
                    new HttpErrorResponse({
                      error: detalle,
                      headers: error.headers,
                      status: error.status,
                      statusText: error.statusText,
                      url: error.url ?? undefined,
                    }),
                ),
              ),
            );
          }),
        );
      }),
    );

  return enviar(false);
};
