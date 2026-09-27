import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdministrationApi, ApiAdminOrganization, ApiAdminRole } from '@core/api';
import { AppStore } from '@core/state';
import { I18nService } from '@core/i18n';
import { RemoteBootstrap } from '@core/session';
import { AdminStore } from '@pages/admin/admin.store';
import { AdminChange, affectsAccess, changeKey, changeWave } from '@pages/admin/admin-changes';
import { AdminPermissionsStore } from './admin-permissions.store';
import { AdminDrafts, SaveFailure } from './admin-drafts';
import { AdminFlagsStore } from './admin-flags.store';

type RoleBody = Parameters<AdministrationApi['saveAdminRole']>[1];

@Injectable()
export class AdminCommands {
  private readonly api = inject(AdministrationApi);
  private readonly app = inject(AppStore);
  private readonly arranque = inject(RemoteBootstrap);
  private readonly i18n = inject(I18nService);
  private readonly store = inject(AdminStore);
  private readonly permisos = inject(AdminPermissionsStore);
  private readonly drafts = inject(AdminDrafts);
  private readonly banderas = inject(AdminFlagsStore);

  async guardarBorrador(): Promise<void> {
    if (this.drafts.saving() || !this.drafts.dirty()) return;
    this.drafts.saving.set(true);
    this.drafts.failures.set([]);
    const pendientes = this.drafts.changes();
    const fallos: SaveFailure[] = [];
    const aplicados: AdminChange[] = [];

    for (const ola of [1, 2, 3, 4] as const) {
      const deLaOla = pendientes.filter((c) => changeWave(c) === ola);
      const resultados = await Promise.allSettled(deLaOla.map((c) => this.ejecutar(c)));
      resultados.forEach((resultado, i) => {
        const cambio = deLaOla[i];
        if (resultado.status === 'fulfilled') {
          aplicados.push(cambio);
          return;
        }
        const reason = resultado.reason instanceof Error ? resultado.reason.message : '';
        fallos.push({ key: changeKey(cambio), label: this.store.describe(cambio), reason });
      });
    }

    this.drafts.quitar(aplicados);
    this.drafts.failures.set(fallos);

    if (aplicados.length) {
      if (aplicados.some(affectsAccess)) await this.store.cargarUsuarios();
      await this.arranque.pollSession();
    }
    this.drafts.saving.set(false);
    this.app.toast.set(
      fallos.length
        ? this.i18n.t('admin.save.partial', { done: aplicados.length, failed: fallos.length })
        : this.i18n.t('admin.save.done', { count: aplicados.length }),
    );
  }

  async eliminarOrganizacion(organization: ApiAdminOrganization): Promise<void> {
    try {
      await firstValueFrom(this.api.deleteAdminOrganization(organization.id));
      this.store.olvidarOrganizacion(organization.id);
      this.app.toast.set(this.i18n.t('admin.organizations.delete.done', { name: organization.name }));
    } catch (error) {
      this.avisarFallo(error, 'admin.organizations.delete.failedReason');
    }
  }

  async consolidarOrganizaciones(): Promise<void> {
    try {
      const result = await firstValueFrom(this.api.consolidateAdminOrganizations());
      this.store.olvidarCaches();
      await this.store.cargar();
      await this.arranque.pollSession();
      this.app.toast.set(
        this.i18n.t('admin.organizations.consolidate.done', {
          users: result.movedUsers,
          organizations: result.deletedOrganizations,
        }),
      );
    } catch (error) {
      this.avisarFallo(error, 'admin.organizations.consolidate.failedReason');
    }
  }

  async crearOrganizacion(body: { name: string; baseCurrency: string }): Promise<void> {
    this.store.ponerOrganizacion(await firstValueFrom(this.api.createAdminOrganization(body)));
    await this.store.cargarRoles(1);
  }

  async renombrarOrganizacion(id: string, name: string): Promise<void> {
    this.store.ponerOrganizacion(await firstValueFrom(this.api.updateAdminOrganization(id, { name })));
  }

  async guardarRol(id: string | null, body: RoleBody): Promise<ApiAdminRole> {
    const saved = await firstValueFrom(
      this.api.saveAdminRole(id, { ...body, permissions: this.permisos.conocidos(body.permissions ?? []) }),
    );
    this.store.ponerRol(saved, id !== null);
    if (id) await this.arranque.pollSession();
    return saved;
  }

  async eliminarRol(role: ApiAdminRole): Promise<void> {
    await firstValueFrom(this.api.deleteAdminRole(role.id));
    this.store.olvidarRolesPorOrganizacion();
    await this.store.cargarRoles(this.store.paginaTrasQuitarRol());
    await this.store.cargarUsuarios();
  }

  private async ejecutar(change: AdminChange): Promise<void> {
    switch (change.kind) {
      case 'userActive':
        await firstValueFrom(this.api.setAdminUserActive(change.userId, change.value));
        this.store.marcarUsuarioActivo(change.userId, change.value);
        return;
      case 'userRoles':
        await firstValueFrom(this.api.assignAdminUserRoles(change.userId, change.organizationId, change.roleIds));
        return;
      case 'userOrganization':
        await firstValueFrom(this.api.addAdminOrganizationMember(change.organizationId, change.userId));
        this.store.olvidarMiembros();
        return;
      case 'roleActive':
        await firstValueFrom(this.api.setAdminRoleActive(change.roleId, change.value));
        this.store.parchearRol(change.roleId, { isActive: change.value });
        return;
      case 'flag':
        await this.banderas.guardar(change);
        return;
      case 'organizationActive':
        this.store.ponerOrganizacion(
          await firstValueFrom(this.api.updateAdminOrganization(change.organizationId, { isActive: change.value })),
        );
        return;
      case 'organizationDefault':
        this.store.fijarPredeterminada(
          await firstValueFrom(this.api.setDefaultAdminOrganization(change.organizationId)),
        );
        return;
    }
  }

  private avisarFallo(error: unknown, claveConMotivo: string): void {
    const reason = error instanceof Error ? error.message : '';
    this.app.toast.set(reason ? this.i18n.t(claveConMotivo, { reason }) : this.i18n.t('admin.toast.loadFailed'));
  }
}
