import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdministrationApi, ApiPermissionDescriptor } from '@core/api';
import { AppStore } from '@core/state';
import { I18nService } from '@core/i18n';

@Injectable()
export class AdminPermissionsStore {
  private readonly api = inject(AdministrationApi);
  private readonly app = inject(AppStore);
  private readonly i18n = inject(I18nService);

  readonly catalog = signal<readonly ApiPermissionDescriptor[]>([]);

  readonly groups = computed(() => {
    const groups = new Map<string, ApiPermissionDescriptor[]>();
    for (const permiso of this.catalog()) {
      const items = groups.get(permiso.resource) ?? [];
      items.push(permiso);
      groups.set(permiso.resource, items);
    }
    return [...groups.entries()].map(([name, items]) => ({ name, items }));
  });

  cargarCatalogo(): Promise<readonly ApiPermissionDescriptor[]> {
    return firstValueFrom(this.api.superAdminPermissions());
  }

  async guardarDescripcion(code: string, descripcion: string): Promise<void> {
    try {
      await firstValueFrom(this.api.setPermissionDescription(code, descripcion.trim() || null));
      this.catalog.set(await this.cargarCatalogo());
      this.app.toast.set(this.i18n.t('admin.permissions.catalog.saved'));
    } catch (error) {
      this.app.toast.set(error instanceof Error ? error.message : this.i18n.t('admin.permissions.catalog.failed'));
      throw error;
    }
  }

  conocidos(permisos: readonly string[]): readonly string[] {
    const catalogo = this.catalog();
    if (!catalogo.length) return permisos;
    const codigos = new Set(catalogo.map((permiso) => permiso.code));
    return permisos.filter((codigo) => codigos.has(codigo));
  }
}
