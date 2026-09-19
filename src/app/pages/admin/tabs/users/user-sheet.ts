import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { IconComponent } from '../../../../ui/icon/icon';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { ApiAdminUser } from '../../../../core/api/administration.api';
import { I18nService } from '../../../../core/i18n';
import { P } from '../../../../core/session/permissions';
import { CAPABILITIES } from '../../../../core/state/store';
import { OptionRowComponent } from '../../../../ui/option-row/option-row';
import { SheetPanelComponent } from '../../../../ui/sheet-panel/sheet-panel';
import { UiSelectComponent } from '../../../../ui/select/select';
import { AdminLabels } from '../../admin-labels';
import { AdminStore } from '../../admin.store';
import { PermissionPickerComponent } from '../../permission-picker/permission-picker';

@Component({
  selector: 'app-user-sheet',
  imports: [
    IconComponent,
    FormsModule,
    HlmButton,
    OptionRowComponent,
    PermissionPickerComponent,
    SheetPanelComponent,
    UiSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fin-sheet-panel
      [open]="!!user()"
      [title]="user()?.displayName ?? ''"
      [subtitle]="user()?.email ?? ''"
      (closed)="closed.emit()"
    >
      @if (user(); as u) {
        @if (caps.allows(P.administracion.usuarios.deshabilitar)) {
          <fin-option-row
            [label]="i18n.t('admin.users.drawer.accessTitle')"
            [description]="i18n.t('admin.users.drawer.accessDetail')"
            [checked]="store.isUserActive(u)"
            [changed]="store.isUserActive(u) !== u.isActive"
            (toggled)="store.setUserActive(u, $event)"
          />
        }
        @if (caps.allows(P.administracion.usuarios.organizacion.editar) && store.organizationOptions().length > 1) {
          <section class="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div>
              <b class="text-sm">{{ i18n.t('admin.users.drawer.organizationTitle') }}</b>
              <p class="text-xs text-muted-foreground">{{ i18n.t('admin.users.drawer.organizationDetail') }}</p>
            </div>
            <fin-select
              [ngModel]="store.targetOrganizationId(u) ?? ''"
              (ngModelChange)="store.setUserOrganization(u, $event)"
              [options]="store.organizationOptions()"
              [ariaLabel]="i18n.t('admin.users.drawer.organizationTitle')"
            />
            @if (store.hasPendingMove(u)) {
              <p class="text-xs text-warning">{{ i18n.t('admin.users.drawer.pendingMove') }}</p>
            }
          </section>
        }
        @if (roles().length) {
          <section class="flex flex-col gap-1">
            <h3 class="text-sm font-semibold">{{ i18n.t('admin.users.drawer.rolesTitle') }}</h3>
            <p class="text-xs text-muted-foreground">{{ i18n.t('admin.users.drawer.rolesHint') }}</p>
            @for (role of roles(); track role.id) {
              <fin-option-row
                kind="checkbox"
                [label]="role.name"
                [description]="role.description || ''"
                [checked]="store.userRoleIds(u).includes(role.id)"
                [changed]="rolesChanged(u)"
                [disabled]="store.hasPendingMove(u)"
                (toggled)="store.toggleUserRole(u, role.id)"
              />
            }
          </section>
        }
        @if (overrides().length) {
          <section class="flex flex-col gap-1">
            <h3 class="text-sm font-semibold">{{ i18n.t('admin.users.drawer.overridesTitle') }}</h3>
            <p class="text-xs text-muted-foreground">{{ i18n.t('admin.users.drawer.overridesHint') }}</p>
            @for (override of overrides(); track override.code) {
              <div class="flex items-center justify-between gap-3 rounded-lg px-3 py-2">
                <span class="flex min-w-0 flex-col">
                  <b class="truncate text-sm">
                    {{
                      override.isAllowed
                        ? i18n.t('admin.users.drawer.overrideForcedYes')
                        : i18n.t('admin.users.drawer.overrideForcedNo')
                    }}
                    · {{ override.code }}
                  </b>
                  <small class="text-xs text-muted-foreground">
                    {{
                      override.affects.length > 1
                        ? i18n.t('admin.users.drawer.overrideAffectsMany', { count: override.affects.length })
                        : i18n.t('admin.users.drawer.overrideAffectsOne')
                    }}
                  </small>
                </span>
                <button
                  hlmBtn
                  variant="ghost"
                  size="sm"
                  [disabled]="store.hasPendingMove(u)"
                  (click)="store.clearOverride(u, override.code)"
                >
                  <fin-icon name="trash" /> {{ i18n.t('admin.users.drawer.removeOverride') }}
                </button>
              </div>
            }
          </section>
        }
        <section class="flex flex-col gap-2">
          <h3 class="text-sm font-semibold">{{ i18n.t('admin.users.drawer.permissionsTitle') }}</h3>
          <p class="text-xs text-muted-foreground">{{ i18n.t('admin.users.drawer.permissionsHint') }}</p>
          <app-permission-picker
            [groups]="store.permissionGroups()"
            [checked]="hasPermission(u)"
            [changed]="permissionChanged(u)"
            [disabled]="store.hasPendingMove(u)"
            (toggled)="store.togglePermission(u, $event)"
          />
        </section>
      }
    </fin-sheet-panel>
  `,
})
export class UserSheetComponent {
  readonly store = inject(AdminStore);
  readonly i18n = inject(I18nService);
  readonly labels = inject(AdminLabels);
  readonly caps = inject(CAPABILITIES);
  readonly P = P;

  readonly user = input.required<ApiAdminUser | null>();
  readonly closed = output<void>();

  readonly organizationId = computed(() => {
    const user = this.user();
    return user ? (this.store.userOrganizationId(user) ?? null) : null;
  });

  readonly roles = computed(() => this.store.rolesOf(this.organizationId() ?? undefined));

  readonly overrides = computed(() => {
    const user = this.user();
    const organizationId = this.organizationId();
    if (!user || !organizationId) return [];
    return user.memberships?.find((m) => m.organizationId === organizationId)?.overrides ?? [];
  });

  constructor() {
    effect(() => {
      const organizationId = this.organizationId();
      if (organizationId) void this.store.cargarRolesDe(organizationId);
    });
  }

  hasPermission(user: ApiAdminUser): (code: string) => boolean {
    return (code) => this.store.hasPermission(user, code);
  }

  permissionChanged(user: ApiAdminUser): (code: string) => boolean {
    return (code) => this.store.permissionChanged(user, code);
  }

  rolesChanged(user: ApiAdminUser): boolean {
    const organizationId = this.organizationId();
    return !!organizationId && this.store.changes().some((c) => c.kind === 'userRoles' && c.userId === user.id);
  }
}
