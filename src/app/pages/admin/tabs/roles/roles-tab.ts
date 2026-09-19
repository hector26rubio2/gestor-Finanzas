import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { ApiAdminRole } from '../../../../core/api/administration.api';
import { I18nService } from '../../../../core/i18n';
import { P } from '../../../../core/permissions';
import { CAPABILITIES, AppStore } from '../../../../core/store';
import { ConfirmDialogComponent } from '../../../../ui/confirm-dialog/confirm-dialog';
import { EmptyStateComponent } from '../../../../ui/empty-state/empty-state';
import { IconComponent } from '../../../../ui/icon';
import { PagerComponent } from '../../../../ui/pager/pager';
import { UiOption, UiSelectComponent } from '../../../../ui/select';
import { AdminStore } from '../../admin.store';
import { RoleSheetComponent } from './role-sheet';

@Component({
  selector: 'app-admin-roles-tab',
  imports: [
    FormsModule,
    HlmBadge,
    HlmButton,
    HlmSwitch,
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
      <section class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">{{ i18n.t('admin.roles.title') }}</h2>
          <p class="text-sm text-muted-foreground">{{ i18n.t('admin.roles.subtitle') }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
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
      </section>
      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        @for (role of store.roles(); track role.id) {
          <article
            class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            [class.opacity-70]="!store.isRoleActive(role)"
          >
            <header class="flex items-start gap-3">
              <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                <fin-icon name="shield" />
              </span>
              <span class="flex min-w-0 flex-1 flex-col">
                <h3 class="flex items-center gap-2 text-sm font-semibold">
                  {{ role.name }}
                  @if (!store.isRoleActive(role)) {
                    <span hlmBadge variant="outline">{{ i18n.t('admin.roles.inactiveBadge') }}</span>
                  }
                </h3>
                <small class="text-xs text-muted-foreground">
                  {{ role.organizationName }} · {{ i18n.t('admin.roles.memberCount', { count: memberCount(role.id) }) }}
                </small>
              </span>
              @if (caps.allows(P.administracion.roles.editar)) {
                <hlm-switch
                  [checked]="store.isRoleActive(role)"
                  [aria-label]="i18n.t(store.isRoleActive(role) ? 'admin.roles.deactivate' : 'admin.roles.activate')"
                  (checkedChange)="store.setRoleActive(role, $event)"
                />
              }
            </header>
            <p class="text-sm text-muted-foreground">{{ role.description || i18n.t('admin.roles.noDescription') }}</p>
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
            <footer class="mt-auto flex justify-end gap-2">
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
                  [attr.aria-label]="i18n.t('admin.roles.deleteAriaLabel')"
                  (click)="deleting.set(role)"
                >
                  <fin-icon name="trash" />
                </button>
              }
            </footer>
          </article>
        }
      </section>
      <fin-pager
        [page]="store.rolesPage()"
        [size]="store.rolesSize"
        [total]="store.rolesTotal()"
        (pageChange)="store.cargarRoles($event)"
      />
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

  readonly filterOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('admin.roles.filter.all') },
    ...this.store.organizations().map((org) => ({ value: org.id, label: org.name })),
  ]);

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
