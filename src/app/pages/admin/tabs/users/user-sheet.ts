import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmRadioGroupImports } from '@spartan-ng/helm/radio-group';
import { IconComponent } from '../../../../ui/icon/icon';
import { ApiAdminUser } from '../../../../core/api/administration.api';
import { I18nService } from '../../../../core/i18n';
import { P } from '../../../../core/session/permissions';
import { CAPABILITIES } from '../../../../core/state/store';
import { OptionRowComponent } from '../../../../ui/option-row/option-row';
import { SheetPanelComponent } from '../../../../ui/sheet-panel/sheet-panel';
import { UiSelectComponent } from '../../../../ui/select/select';
import { AdminLabels } from '../../admin-labels';
import { AdminStore } from '../../admin.store';
import { RESOURCE_FEATURE } from '../../permission-picker/permission-sections';

@Component({
  selector: 'app-user-sheet',
  imports: [
    FormsModule,
    HlmBadge,
    HlmRadioGroupImports,
    IconComponent,
    OptionRowComponent,
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
        <section class="flex flex-col gap-1">
          <h3 class="text-sm font-semibold">{{ i18n.t('admin.users.drawer.rolesTitle') }}</h3>
          <p class="text-xs text-muted-foreground">{{ i18n.t('admin.users.drawer.rolesHint') }}</p>
          <hlm-radio-group
            class="gap-1"
            [name]="'role-' + u.id"
            [value]="selectedRoleId(u)"
            [disabled]="store.hasPendingMove(u)"
            (valueChange)="pickRole(u, $event)"
          >
            @for (role of roles(); track role.id) {
              <label
                class="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-accent/60 has-[[data-disabled]]:opacity-60"
              >
                <span class="flex min-w-0 flex-col gap-0.5">
                  <span class="flex items-center gap-2 text-sm font-medium">
                    {{ role.name }}
                    @if (rolesChanged(u) && selectedRoleId(u) === role.id) {
                      <span hlmBadge variant="secondary">{{ i18n.t('admin.common.unsaved') }}</span>
                    }
                  </span>
                  @if (role.description) {
                    <small class="truncate text-xs text-muted-foreground">{{ role.description }}</small>
                  }
                </span>
                <hlm-radio [value]="role.id" [disabled]="!role.isActive" [attr.aria-label]="role.name">
                  <hlm-radio-indicator indicator />
                </hlm-radio>
              </label>
            }
          </hlm-radio-group>
          @if (!roles().length) {
            <p class="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              {{ i18n.t('admin.users.drawer.noRoles') }}
            </p>
          }
        </section>
        <section class="flex flex-col gap-2">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h3 class="text-sm font-semibold">{{ i18n.t('admin.users.drawer.effectiveTitle') }}</h3>
              <p class="text-xs text-muted-foreground">{{ i18n.t('admin.users.drawer.effectiveHint') }}</p>
            </div>
            <span hlmBadge variant="secondary">{{ effective().length }}</span>
          </div>
          @for (group of effectiveGroups(); track group.name) {
            <div class="flex flex-col gap-1.5 rounded-lg border border-border p-3">
              <b class="text-xs uppercase tracking-wide text-muted-foreground">{{ labels.resource(group.name) }}</b>
              <div class="flex flex-wrap gap-1.5">
                @for (permission of group.items; track permission.code) {
                  <span hlmBadge variant="outline" [attr.title]="permission.code">
                    <fin-icon name="check" class="[--icon-size:12px]" />{{ permission.description }}
                  </span>
                }
              </div>
            </div>
          } @empty {
            <p class="text-xs text-muted-foreground">{{ i18n.t('admin.users.drawer.effectiveEmpty') }}</p>
          }
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

  readonly effective = computed(() => {
    const user = this.user();
    return user ? this.store.effectivePermissions(user) : [];
  });

  readonly effectiveGroups = computed(() => {
    const granted = new Set(this.effective());
    const organizationId = this.organizationId();
    const flags = organizationId ? this.store.organizationFlagsOf(organizationId) : undefined;
    const off = new Set((flags ?? []).filter((flag) => !flag.isEnabled).map((flag) => flag.key));
    return this.store
      .permissionGroups()
      .filter((group) => !off.has(RESOURCE_FEATURE[group.name] ?? ''))
      .map((group) => ({ name: group.name, items: group.items.filter((item) => granted.has(item.code)) }))
      .filter((group) => group.items.length);
  });

  constructor() {
    effect(() => {
      const organizationId = this.organizationId();
      if (organizationId) {
        void this.store.cargarRolesDe(organizationId);
        void this.store.cargarBanderasDe(organizationId);
      }
    });
  }

  selectedRoleId(user: ApiAdminUser): string | null {
    return this.store.userRoleIds(user)[0] ?? null;
  }

  pickRole(user: ApiAdminUser, roleId: unknown): void {
    if (typeof roleId === 'string') this.store.setUserRole(user, roleId);
  }

  rolesChanged(user: ApiAdminUser): boolean {
    const organizationId = this.organizationId();
    return !!organizationId && this.store.changes().some((c) => c.kind === 'userRoles' && c.userId === user.id);
  }
}
