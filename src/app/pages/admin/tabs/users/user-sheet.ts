import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadge } from '@spartan-ng/helm/badge';
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

@Component({
  selector: 'app-user-sheet',
  imports: [FormsModule, HlmBadge, IconComponent, OptionRowComponent, SheetPanelComponent, UiSelectComponent],
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
          @for (role of roles(); track role.id) {
            <fin-option-row
              kind="checkbox"
              [label]="role.name"
              [description]="role.description || ''"
              [checked]="store.userRoleIds(u).includes(role.id)"
              [changed]="rolesChanged(u)"
              [disabled]="store.hasPendingMove(u) || !role.isActive"
              (toggled)="store.toggleUserRole(u, role.id)"
            />
          } @empty {
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
    return this.store
      .permissionGroups()
      .map((group) => ({ name: group.name, items: group.items.filter((item) => granted.has(item.code)) }))
      .filter((group) => group.items.length);
  });

  constructor() {
    effect(() => {
      const organizationId = this.organizationId();
      if (organizationId) void this.store.cargarRolesDe(organizationId);
    });
  }

  rolesChanged(user: ApiAdminUser): boolean {
    const organizationId = this.organizationId();
    return !!organizationId && this.store.changes().some((c) => c.kind === 'userRoles' && c.userId === user.id);
  }
}
