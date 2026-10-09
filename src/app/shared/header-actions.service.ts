import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HeaderActionsService {
  readonly exportReport = signal<(() => void) | null>(null);
  readonly exportMovements = signal<(() => void) | null>(null);
  readonly readAll = signal<(() => void) | null>(null);
  readonly sinLeer = signal(0);
  readonly puedeMarcarTodas = computed(() => this.readAll() !== null && this.sinLeer() > 0);
}
