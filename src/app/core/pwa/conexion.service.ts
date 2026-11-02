import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class Conexion {
  readonly enLinea = signal(true);
  private iniciado = false;

  iniciar(): void {
    if (this.iniciado) return;
    this.iniciado = true;
    this.enLinea.set(window.navigator.onLine);
    window.addEventListener('online', () => this.enLinea.set(true));
    window.addEventListener('offline', () => this.enLinea.set(false));
  }
}
