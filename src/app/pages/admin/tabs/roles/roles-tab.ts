import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { ApiAdminRole } from '../../../../core/api/administration.api';
import { I18nService } from '../../../../core/i18n';
import { P } from '../../../../core/session/permissions';
import { CAPABILITIES, AppStore } from '../../../../core/state/store';
import { ConfirmDialogComponent } from '../../../../ui/confirm-dialog/confirm-dialog';
import { EmptyStateComponent } from '../../../../ui/empty-state/empty-state';
import { IconComponent } from '../../../../ui/icon/icon';
import { PagerComponent } from '../../../../ui/pager/pager';
import { UiOption, UiSelectComponent } from '../../../../ui/select/select';
import { AdminStore } from '../../admin.store';
import { AdminPanelComponent } from '../../panel/admin-panel';
import { RoleSheetComponent } from './role-sheet';

@Component({
  selector: 'app-admin-roles-tab',
  imports: [
    FormsModule,
    HlmBadge,
    HlmButton,
    HlmInput,
    HlmSwitch,
    HlmTableImports,
    AdminPanelComponent,
    ConfirmDialogComponent,
    EmptyStateComponent,
    IconComponent,
    PagerComponent,
    RoleSheetComponent,
    UiSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.sinDatos()) {
      <fin-empty [title]="i18n.t('admin.emptyState.title')" [detail]="i18n.t('admin.emptyState.roles.detail')" />
    } @else {
      <app-admin-panel [title]="i18n.t('admin.roles.title')" [subtitle]="i18n.t('admin.roles.subtitle')">
        <div panelActions class="flex flex-wrap items-center gap-2">
          <label class="relative">
            <fin-icon
              name="search"
              class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              hlmInput
              class="w-64 ps-9"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              [placeholder]="i18n.t('admin.roles.searchPlaceholder')"
              [attr.aria-label]="i18n.t('admin.roles.searchPlaceholder')"
            />
          </label>
          @if (store.organizations().length > 1) {
            <fin-select
              class="w-56"
              [ngModel]="store.rolesOrganizationFilter()"
              (ngModelChange)="store.cargarRoles(1, $event)"
              [options]="filterOptions()"
              [ariaLabel]="i18n.t('admin.roles.filter.ariaLabel')"
            />
          }
          @if (caps.allows(P.administracion.roles.crear)) {
            <button hlmBtn (click)="creating.set(true)">
              <fin-icon name="plus" /> {{ i18n.t('admin.roles.actions.create') }}
            </button>
          }
        </div>
        <div hlmTableContainer>
          <table hlmTable [attr.aria-label]="i18n.t('admin.roles.title')">
            <thead hlmTHead class="bg-muted/40">
              <tr hlmTr>
                <th hlmTh class="h-11 px-5">{{ i18n.t('admin.roles.column.role') }}</th>
                <th hlmTh class="px-4">{{ i18n.t('admin.roles.drawer.organizationLabel') }}</th>
                <th hlmTh class="px-4">{{ i18n.t('admin.roles.column.members') }}</th>
                <th hlmTh class="px-4">{{ i18n.t('admin.roles.column.permissions') }}</th>
                <th hlmTh class="px-4">{{ i18n.t('admin.roles.column.active') }}</th>
                <th hlmTh class="w-32 px-5">
                  <span class="sr-only">{{ i18n.t('admin.common.actions') }}</span>
                </th>
              </tr>
            </thead>
            <tbody hlmTBody>
              @for (role of visibleRoles(); track role.id) {
                <tr hlmTr [class.opacity-60]="!store.isRoleActive(role)">
                  <td hlmTd class="px-5 py-3 whitespace-normal">
                    <div class="flex items-center gap-3">
                      <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                        <fin-icon name="shield" />
                      </span>
                      <span class="flex min-w-0 flex-col">
                        <b class="text-sm">{{ role.name }}</b>
                        <small class="max-w-sm truncate text-xs text-muted-foreground">
                          {{ role.description || i18n.t('admin.roles.noDescription') }}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td hlmTd class="px-4">{{ role.organizationName }}</td>
                  <td hlmTd class="px-4 tabular-nums">{{ memberCount(role.id) }}</td>
                  <td hlmTd class="min-w-[24rem] px-4 whitespace-normal">
                    <div class="flex flex-wrap gap-1.5">
                      @for (recurso of resourcesOf(role).slice(0, 4); track recurso) {
                        <span hlmBadge variant="secondary">{{ recurso }}</span>
                      }
                      @if (resourcesOf(role).length > 4) {
                        <span hlmBadge variant="outline">{{
                          i18n.t('admin.roles.moreChip', { count: resourcesOf(role).length - 4 })
                        }}</span>
                      }
                      <span hlmBadge variant="outline">{{
                        i18n.t('admin.roles.actionsCount', { count: role.permissions.length })
                      }}</span>
                    </div>
                  </td>
                  <td hlmTd class="px-4">
                    <span class="flex items-center gap-2">
                      @if (caps.allows(P.administracion.roles.editar)) {
                        <hlm-switch
                          [checked]="store.isRoleActive(role)"
                          [aria-label]="
                            i18n.t(store.isRoleActive(role) ? 'admin.roles.deactivate' : 'admin.roles.activate') +
                            ': ' +
                            role.name
                          "
                          (checkedChange)="store.setRoleActive(role, $event)"
                        />
                      }
                      <span class="text-xs text-muted-foreground">{{
                        store.isRoleActive(role)
                          ? i18n.t('admin.users.state.active')
                          : i18n.t('admin.roles.inactiveBadge')
                      }}</span>
                    </span>
                  </td>
                  <td hlmTd class="px-5 text-end">
                    <span class="inline-flex items-center gap-2">
                      @if (caps.allows(P.administracion.roles.editar)) {
                        <button hlmBtn variant="outline" size="sm" (click)="editing.set(role)">
                          <fin-icon name="edit" /> {{ i18n.t('admin.roles.actions.edit') }}
                        </button>
                      }
                      @if (caps.allows(P.administracion.roles.eliminar) && !role.isSystem) {
                        <button
                          hlmBtn
                          variant="destructive"
                          size="icon-sm"
                          [attr.aria-label]="i18n.t('admin.roles.deleteAriaLabel') + ': ' + role.name"
                          (click)="deleting.set(role)"
                        >
                          <fin-icon name="trash" />
                        </button>
                      }
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr hlmTr>
                  <td hlmTd colspan="6" class="py-10 text-center text-muted-foreground">{{ i18n.t('table.empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <fin-pager
          class="border-t border-border px-5 py-3"
          [page]="store.rolesPage()"
          [size]="store.rolesSize"
          [total]="store.rolesTotal()"
          [summary]="i18n.t('admin.roles.countLabel', { count: visibleRoles().length })"
          (pageChange)="store.cargarRoles($event)"
        />
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
  readonly search = signal('');
  readonly deleting = signal<ApiAdminRole | null>(null);

  readonly filterOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('admin.roles.filter.all') },
    ...this.store.organizations().map((org) => ({ value: org.id, label: org.name })),
  ]);

  readonly visibleRoles = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.store
      .roles()
      .filter((role) => !term || `${role.name} ${role.organizationName ?? ''}`.toLowerCase().includes(term));
  });

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
