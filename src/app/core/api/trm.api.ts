import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, of } from 'rxjs';

const TRM_ENDPOINT = 'https://www.datos.gov.co/resource/32sa-8pi3.json';

interface TrmRow {
  valor: string;
  vigenciadesde: string;
}

@Injectable({ providedIn: 'root' })
export class TrmApi {
  private readonly http = inject(HttpClient);

  today() {
    const hoy = new Date().toISOString().slice(0, 10);
    return this.http.get<TrmRow[]>(TRM_ENDPOINT, { params: { vigenciadesde: hoy, $limit: '1' } }).pipe(
      map((rows) => (rows[0] ? Number(rows[0].valor) : null)),
      catchError(() => of(null)),
    );
  }
}
