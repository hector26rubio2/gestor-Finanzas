import { Injectable, computed, signal } from '@angular/core';
import { AdminChange, changeKey } from '@pages/admin/admin-changes';

export interface SaveFailure {
  key: string;
  label: string;
  reason: string;
}

@Injectable()
export class AdminDrafts {
  private readonly pending = signal<ReadonlyMap<string, AdminChange>>(new Map());
  readonly changes = computed(() => [...this.pending().values()]);
  readonly count = computed(() => this.pending().size);
  readonly dirty = computed(() => this.pending().size > 0);
  readonly failures = signal<readonly SaveFailure[]>([]);
  readonly saving = signal(false);

  draft<K extends AdminChange['kind']>(kind: K, key: string): Extract<AdminChange, { kind: K }> | undefined {
    const change = this.pending().get(key);
    return change?.kind === kind ? (change as Extract<AdminChange, { kind: K }>) : undefined;
  }

  has(key: string): boolean {
    return this.pending().has(key);
  }

  put(change: AdminChange, equalsBase: boolean): void {
    this.pending.update((map) => {
      const next = new Map(map);
      if (equalsBase) next.delete(changeKey(change));
      else next.set(changeKey(change), change);
      return next;
    });
    this.failures.set(this.failures().filter((f) => f.key !== changeKey(change)));
  }

  quitarDonde(predicado: (change: AdminChange) => boolean): void {
    this.pending.update((map) => new Map([...map].filter(([, change]) => !predicado(change))));
  }

  quitar(aplicados: readonly AdminChange[]): void {
    const claves = new Set(aplicados.map(changeKey));
    this.pending.update((map) => new Map([...map].filter(([key]) => !claves.has(key))));
  }

  descartar(): void {
    this.pending.set(new Map());
    this.failures.set([]);
  }
}
