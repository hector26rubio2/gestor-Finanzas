import { Injectable, signal } from '@angular/core';

@Injectable()
export class ErroresDeFormulario {
  readonly porCampo = signal<Readonly<Record<string, string>>>({});

  de(campo: string): string {
    return this.porCampo()[campo] ?? '';
  }

  definir(errores: Readonly<Record<string, string>>): void {
    this.porCampo.set(errores);
  }

  limpiar(campo: string): void {
    if (!this.porCampo()[campo]) return;
    const resto = { ...this.porCampo() };
    delete resto[campo];
    this.porCampo.set(resto);
  }

  hay(): boolean {
    return Object.keys(this.porCampo()).length > 0;
  }
}
