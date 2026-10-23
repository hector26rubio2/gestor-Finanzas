import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FinanceApiClient } from '@core/api/api-client';
import { I18nService } from '@core/i18n';
import { AppStore } from './store';
import { renombrarEnMovimientos } from './catalog-mappers';

/** Comandos de alta/edición de categorías, con renombrado propagado a los movimientos. */
@Injectable({ providedIn: 'root' })
export class CategoriesCommands {
  constructor(
    private readonly store: AppStore,
    private readonly client: FinanceApiClient,
    private readonly i18n: I18nService,
  ) {}

  async createCategory(name: string, color: string, icon: string, kind: 'income' | 'expense' = 'expense') {
    const type = kind === 'income' ? 1 : 2;
    const created = await firstValueFrom(this.client.createCategory({ name, type, color, icon }));
    this.store.categories.update((items) => [...items, created]);

    this.store.form.set(null);
    this.store.toast.set(this.i18n.t('toast.category.created', { name }));
  }

  async updateCategory(id: string, changes: { name: string; color: string; icon: string }) {
    const name = changes.name.trim();
    if (!name) throw new Error(this.i18n.t('form.management.error.nameRequired'));
    const actual = this.store.categories().find((category) => category.id === id);
    if (!actual) throw new Error(this.i18n.t('form.error.notFound'));
    const guardada = await firstValueFrom(
      this.client.updateCategory(id, {
        name,
        color: changes.color,
        icon: changes.icon,
        parent: actual.parent,
        isActive: actual.isActive,
      }),
    );
    this.store.categories.update((items) => items.map((item) => (item.id === id ? guardada : item)));
    if (actual.name !== guardada.name)
      this.store.data.update((data) => ({
        ...data,
        movements: renombrarEnMovimientos(data.movements, 'category', actual.name, guardada.name),
      }));
    this.store.form.set(null);
    this.store.toast.set(this.i18n.t('toast.category.updated', { name: guardada.name }));
  }
}
