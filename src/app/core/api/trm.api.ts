import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, of } from 'rxjs';

/**
 * TRM oficial del día, certificada por la Superintendencia Financiera y publicada
 * sin autenticación en el portal de datos abiertos del Estado colombiano.
 *
 * Es solo de referencia: el campo `exchangeRate` del movimiento lo sigue
 * escribiendo la persona a mano con la tasa real que le cobró el banco, casi nunca
 * la oficial exacta. Si esta consulta falla, el campo manual sigue funcionando
 * igual — nunca bloquea el registro de un movimiento.
 */
const TRM_ENDPOINT = 'https://www.datos.gov.co/resource/32sa-8pi3.json';

interface TrmRow {
  valor: string;
  vigenciadesde: string;
}

@Injectable({ providedIn: 'root' })
export class TrmApi {
  private readonly http = inject(HttpClient);

  /** `null` cuando la consulta pública falla o no hay dato para hoy — nunca un valor inventado. */
  today() {
    const hoy = new Date().toISOString().slice(0, 10);
    return this.http.get<TrmRow[]>(TRM_ENDPOINT, { params: { vigenciadesde: hoy, $limit: '1' } }).pipe(
      map((rows) => (rows[0] ? Number(rows[0].valor) : null)),
      catchError(() => of(null)),
    );
  }
}
