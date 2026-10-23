import { Provider } from '@angular/core';
import { Observable } from 'rxjs';
import { API_TRANSPORT, ApiProblem, ApiRequest, ApiRequestError, ApiTransport } from '@core/http/api-http-client';

/** Respuesta configurable del transport falso. */
export interface RespuestaFalsa<TCuerpo = unknown> {
  /** Cuerpo 200/2xx que devuelve la petición. */
  body?: TCuerpo;
  /** Estado de error: si se define, la petición falla con ApiRequestError. */
  error?: Partial<ApiProblem> & { status: number };
  /** Latencia específica de esta respuesta (ms). Si no, usa la del transport. */
  latenciaMs?: number;
}

interface RutaFalsa {
  coincide: string | RegExp;
  respuesta: RespuestaFalsa | ((peticion: ApiRequest) => RespuestaFalsa | undefined);
}

/**
 * Transport de API en memoria: implementa el contrato de `API_TRANSPORT`
 * para testear comandos sin HTTP real.
 *
 * ```ts
 * const transport = new TransportFalso()
 *   .responder('POST /api/v1/accounts', { body: { id: 'a1', name: 'Corriente', currency: 'COP' } })
 *   .responder('GET /api/v1/movements', { error: { status: 403, code: 'authorization.denied' } }, )
 *   .responder('POST /api/v1/reports', { latenciaMs: 50, body: [] });
 * //   responder con función cuando la respuesta depende del body:
 *   .responder('POST /api/v1/accounts', ({ body }) => ({ body: { id: `a-${n++}` } }))
 * ```
 *
 * Todas las peticiones quedan en `transport.peticiones` para aserciones.
 * Si no hay respuesta configurada para una petición, falla con un error explícito
 * (así los specs detectan rutas no previstas).
 */
export class TransportFalso implements ApiTransport {
  readonly peticiones: ApiRequest[] = [];
  private rutas: RutaFalsa[] = [];
  private planificador: ((peticion: ApiRequest) => RespuestaFalsa | undefined) | null = null;

  constructor(private readonly latenciaPorDefectoMc = 0) {}

  /** Registra una respuesta. El match es 'METODO /ruta' (o regex sobre ese texto). */
  responder(
    coincide: string | RegExp,
    respuesta: RespuestaFalsa | ((peticion: ApiRequest) => RespuestaFalsa | undefined),
  ): this {
    this.rutas.push({ coincide, respuesta });
    return this;
  }

  /** Plan de primera intención: última respuesta que devuelve undefined no configurado. */
  planear(planificador: (peticion: ApiRequest) => RespuestaFalsa | undefined): this {
    this.planificador = planificador;
    return this;
  }

  request<TRespuesta, TCuerpo>(peticion: ApiRequest<TCuerpo>): Observable<TRespuesta> {
    this.peticiones.push(peticion as ApiRequest);
    const hallada = [...this.rutas].reverse().find((ruta) => this.esCoincidencia(ruta.coincide, peticion));
    const provisional = hallada
      ? typeof hallada.respuesta === 'function'
        ? hallada.respuesta(peticion as ApiRequest)
        : hallada.respuesta
      : undefined;
    const respuesta = provisional ?? this.planificador?.(peticion as ApiRequest) ?? null;
    return new Observable<TRespuesta>((suscriptor) => {
      const latencia = respuesta?.latenciaMs ?? this.latenciaPorDefectoMc;
      const termino = () => {
        if (!respuesta) {
          suscriptor.error(
            new Error(`TransportFalso: no hay respuesta configurada para ${peticion.method} ${peticion.path}`),
          );
          return;
        }
        if (respuesta.error) {
          suscriptor.error(new ApiRequestError(respuesta.error.status, respuesta.error as ApiProblem));
          return;
        }
        suscriptor.next(respuesta.body as TRespuesta);
        suscriptor.complete();
      };
      if (latencia > 0) setTimeout(termino, latencia);
      else termino();
    });
  }

  /** `{ provide: API_TRANSPORT, useValue: this }`. */
  proveedor(): Provider {
    return { provide: API_TRANSPORT, useValue: this };
  }

  /** Limpia peticiones y respuestas registradas entre tests. */
  limpiar(): void {
    this.peticiones.length = 0;
    this.rutas = [];
    this.planificador = null;
  }

  private esCoincidencia(coincide: string | RegExp, peticion: ApiRequest): boolean {
    const texto = `${peticion.method} ${peticion.path}`;
    return typeof coincide === 'string' ? coincide === texto : coincide.test(texto);
  }
}
