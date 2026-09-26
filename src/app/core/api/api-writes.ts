import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiWritesBus {
  readonly version = signal(0);

  notify(): void {
    this.version.update((valor) => valor + 1);
  }
}
