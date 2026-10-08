import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiBudget, BudgetsApi } from '@core/api';
import { I18nService } from '@core/i18n';
import { AppStore } from '@core/state';
import { montoDeApi } from '@shared/presupuestos';

export type EstadoDeCarga = 'inactivo' | 'cargando' | 'listo' | 'error';

@Injectable({ providedIn: 'root' })
export class BudgetsStore {
  private readonly api = inject(BudgetsApi);
  private readonly store = inject(AppStore);
  private readonly i18n = inject(I18nService);

  readonly items = signal<readonly ApiBudget[]>([]);
  readonly estado = signal<EstadoDeCarga>('inactivo');
  readonly guardando = signal<string | null>(null);
  readonly errorDeGuardado = signal('');
  readonly cargando = computed(() => this.estado() === 'cargando' || this.estado() === 'inactivo');

  async asegurarCarga(): Promise<void> {
    if (this.estado() === 'cargando' || this.estado() === 'listo') return;
    await this.recargar();
  }

  async recargar(): Promise<void> {
    this.estado.set('cargando');
    try {
      this.items.set(await firstValueFrom(this.api.budgets()));
      this.estado.set('listo');
    } catch {
      this.estado.set('error');
    }
  }

  async fijar(categoryId: string, limite: number): Promise<boolean> {
    return this.escribir(categoryId, async () => {
      const moneda = this.store.baseCurrency();
      const guardado = await firstValueFrom(
        this.api.setBudget(categoryId, { amount: montoDeApi(limite, moneda), currency: moneda }),
      );
      this.items.update((lista) => [...lista.filter((item) => item.category.id !== categoryId), guardado]);
    });
  }

  async quitar(categoryId: string): Promise<boolean> {
    return this.escribir(categoryId, async () => {
      await firstValueFrom(this.api.deleteBudget(categoryId));
      this.items.update((lista) => lista.filter((item) => item.category.id !== categoryId));
    });
  }

  private async escribir(categoryId: string, accion: () => Promise<void>): Promise<boolean> {
    this.guardando.set(categoryId);
    this.errorDeGuardado.set('');
    try {
      await accion();
      return true;
    } catch (error) {
      this.errorDeGuardado.set(error instanceof Error ? error.message : this.i18n.t('budgets.error.save'));
      return false;
    } finally {
      this.guardando.set(null);
    }
  }
}
