import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { ApiAdminRole } from '../../../../core/api/administration.api';
import { I18nService } from '../../../../core/i18n';
import { P } from '../../../../core/session/permissions';
import { CAPABILITIES, AppStore } from '../../../../core/state/store';
import { ConfirmDialogComponent } from '../../../../ui/confirm-dialog/confirm-dialog';
import { EmptyStateComponent } from '../../../../ui/empty-state/empty-state';
import { DataTableComponent, TableColumn } from '../../../../ui/data-table/data-table';
import { FinTableCellDirective } from '../../../../ui/data-table/table-cell.directive';
import { IconComponent } from '../../../../ui/icon/icon';
import { PagerComponent } from '../../../../ui/pager/pager';
import { AdminStore } from '../../admin.store';
import { AdminGridComponent } from '../../panel/admin-grid';
import { AdminPanelComponent } from '../../panel/admin-panel';
import { RoleSheetComponent } from './role-sheet';

@Component({
  selector: 'app-admin-roles-tab',
  imports: [
    HlmBadge,
    HlmButton,
    HlmSwitch,
    AdminGridComponent,
    AdminPanelComponent,
    DataTableComponent,
    FinTableCellDirective,
    ConfirmDialogComponent,
    EmptyStateComponent,
    IconComponent,
    PagerComponent,
    RoleSheetComponent,
  ],
  host: { class: 'flex min-w-0 flex-col gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.sinDatos()) {
      <fin-empty [title]="i18n.t('admin.emptyState.title')" [detail]="i18n.t('admin.emptyState.roles.detail')" />
    } @else {
      <app-admin-panel [title]="i18n.t('admin.roles.title')" [subtitle]="i18n.t('admin.roles.subtitle')">
        <div panelActions class="flex flex-wrap items-center gap-2">
          @if (caps.allows(P.administracion.roles.crear)) {
            <button hlmBtn (click)="creating.set(true)">
              <fin-icon name="plus" /> {{ i18n.t('admin.roles.actions.create') }}
            </button>
          }
        </div>
        <app-admin-grid>
          <fin-table
            [columns]="columns()"
            [rows]="rows()"
            [selectable]="false"
            [pageSize]="15"
            [tableLabel]="i18n.t('admin.roles.title')"
          >
            <ng-template finCell="role" let-row>
              <div class="flex items-center gap-3">
                <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                  <fin-icon name="shield" />
                </span>
                <span class="flex min-w-0 flex-col">
                  <b class="text-sm">{{ row.raw.name }}</b>
                  <small class="max-w-xs truncate text-xs text-muted-foreground">
                    {{ row.raw.description || i18n.t('admin.roles.noDescription') }}
                  </small>
                </span>
              </div>
            </ng-template>
            <ng-template finCell="permissions" let-row>
              <div class="flex flex-wrap gap-1.5">
                @for (recurso of resourcesOf(row.raw).slice(0, 2); track recurso) {
                  <span hlmBadge variant="secondary">{{ recurso }}</span>
                }
                @if (resourcesOf(row.raw).length > 2) {
                  <span hlmBadge variant="outline">{{
                    i18n.t('admin.roles.moreChip', { count: resourcesOf(row.raw).length - 2 })
                  }}</span>
                }
                <span hlmBadge variant="outline">{{
                  i18n.t('admin.roles.actionsCount', { count: row.raw.permissions.length })
                }}</span>
              </div>
            </ng-template>
            <ng-template finCell="active" let-row>
              <span class="flex items-center gap-2">
                @if (caps.allows(P.administracion.roles.editar)) {
                  <hlm-switch
                    [checked]="store.isRoleActive(row.raw)"
                    [aria-label]="
                      i18n.t(store.isRoleActive(row.raw) ? 'admin.roles.deactivate' : 'admin.roles.activate') +
                      ': ' +
                      row.raw.name
                    "
                    (checkedChange)="store.setRoleActive(row.raw, $event)"
                  />
                }
                <span class="text-xs text-muted-foreground">{{ row.active }}</span>
              </span>
            </ng-template>
            <ng-template finCell="actions" let-row>
              <span class="inline-flex items-center gap-2">
                @if (caps.allows(P.administracion.roles.editar)) {
                  <button hlmBtn variant="outline" size="sm" (click)="editing.set(row.raw)">
                    <fin-icon name="edit" /> {{ i18n.t('admin.roles.actions.edit') }}
                  </button>
                }
                @if (caps.allows(P.administracion.roles.eliminar) && !row.raw.isSystem) {
                  <button
                    hlmBtn
                    variant="destructive"
                    size="icon-sm"
                    [attr.aria-label]="i18n.t('admin.roles.deleteAriaLabel') + ': ' + row.raw.name"
                    (click)="deleting.set(row.raw)"
                  >
                    <fin-icon name="trash" />
                  </button>
                }
              </span>
            </ng-template>
          </fin-table>
        </app-admin-grid>
        @if (store.rolesTotal() > store.rolesSize) {
          <fin-pager
            class="border-t border-border px-5 py-3"
            [page]="store.rolesPage()"
            [size]="store.rolesSize"
            [total]="store.rolesTotal()"
            [summary]="i18n.t('admin.roles.countLabel', { count: store.roles().length })"
            (pageChange)="store.cargarRoles($event)"
          />
        }
      </app-admin-panel>
    }
    <app-role-sheet [role]="editing()" [creating]="creating()" (closed)="closeSheet()" />
    <fin-confirm-dialog
      [open]="!!deleting()"
      [title]="i18n.t('admin.roles.confirmDeleteTitle')"
      [description]="i18n.t('admin.roles.confirmDelete', { name: deleting()?.name ?? '' })"
      [confirmLabel]="i18n.t('admin.roles.deleteAriaLabel')"
      [cancelLabel]="i18n.t('admin.common.cancel')"
      (confirmed)="confirmDelete()"
      (dismissed)="deleting.set(null)"
    />
  `,
})
export class RolesTabComponent {
  readonly store = inject(AdminStore);
  readonly i18n = inject(I18nService);
  readonly caps = inject(CAPABILITIES);
  private readonly app = inject(AppStore);
  readonly P = P;

  readonly editing = signal<ApiAdminRole | null>(null);
  readonly creating = signal(false);
  readonly deleting = signal<ApiAdminRole | null>(null);

  readonly columns = computed<TableColumn[]>(() => [
    { key: 'role', label: this.i18n.t('admin.roles.column.role') },
    { key: 'organization', label: this.i18n.t('admin.roles.drawer.organizationLabel'), facet: true },
    { key: 'members', label: this.i18n.t('admin.roles.column.members') },
    { key: 'permissions', label: this.i18n.t('admin.roles.column.permissions'), sortKey: 'permissionCount' },
    { key: 'active', label: this.i18n.t('admin.roles.column.active'), facet: true },
    { key: 'actions', label: this.i18n.t('admin.common.actions'), sortable: false, hideable: false },
  ]);

  readonly rows = computed(() =>
    this.store.roles().map((role) => ({
      id: role.id,
      role: `${role.name} ${role.description ?? ''}`,
      organization: role.organizationName ?? '—',
      members: this.memberCount(role.id),
      permissions: this.resourcesOf(role).join(' '),
      permissionCount: role.permissions.length,
      active: this.store.isRoleActive(role)
        ? this.i18n.t('admin.users.state.active')
        : this.i18n.t('admin.roles.inactiveBadge'),
      raw: role,
    })),
  );

  resourcesOf(role: ApiAdminRole): readonly string[] {
    return [...new Set((role.permissions ?? []).map((code) => code.split('.')[0]))].sort();
  }

  memberCount(roleId: string): number {
    return this.store.users().filter((user) => user.memberships?.some((m) => m.roles.some((r) => r.id === roleId)))
      .length;
  }

  closeSheet(): void {
    this.editing.set(null);
    this.creating.set(false);
  }

  async confirmDelete(): Promise<void> {
    const role = this.deleting();
    this.deleting.set(null);
    if (!role) return;
    try {
      await this.store.eliminarRol(role);
      this.app.toast.set(this.i18n.t('admin.toast.deleteRoleSucceeded', { name: role.name }));
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      this.app.toast.set(
        reason
          ? this.i18n.t('admin.toast.deleteRoleFailedReason', { reason })
          : this.i18n.t('admin.toast.deleteRoleFailed'),
      );
    }
  }
}
