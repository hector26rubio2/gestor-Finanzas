import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  readonly abierto = signal(false);
  readonly solicitada = signal(false);

  abrir(): void {
    this.solicitada.set(true);
    this.abierto.set(true);
  }

  alternar(): void {
    if (this.abierto()) this.abierto.set(false);
    else this.abrir();
  }
}
