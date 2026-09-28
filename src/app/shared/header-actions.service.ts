import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HeaderActionsService {
  readonly exportReport = signal<(() => void) | null>(null);
  readonly exportMovements = signal<(() => void) | null>(null);
  readonly readAll = signal<(() => void) | null>(null);
}
