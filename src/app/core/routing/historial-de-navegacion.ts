import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { rutaSinValores } from '@core/http/registro-de-peticiones';

const MAX_PANTALLAS = 15;

@Injectable({ providedIn: 'root' })
export class HistorialDeNavegacion {
  private readonly router = inject(Router);
  private readonly pantallas: string[] = [];
  private iniciado = false;

  iniciar(): void {
    if (this.iniciado) return;
    this.iniciado = true;
    this.router.events
      .pipe(filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd))
      .subscribe((evento) => {
        this.pantallas.push(rutaSinValores(evento.urlAfterRedirects, ''));
        if (this.pantallas.length > MAX_PANTALLAS) this.pantallas.shift();
      });
  }

  recientes(): readonly string[] {
    return [...this.pantallas];
  }
}
