import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { ApiAdminUser } from '../../../../core/api/administration.api';
import { I18nService } from '../../../../core/i18n';
import { P } from '../../../../core/session/permissions';
import { CAPABILITIES } from '../../../../core/state/store';
import { EmptyStateComponent } from '../../../../ui/empty-state/empty-state';
import { IconComponent } from '../../../../ui/icon/icon';
import { PagerComponent } from '../../../../ui/pager/pager';
import { UiOption, UiSelectComponent } from '../../../../ui/select/select';
import { AdminLabels } from '../../admin-labels';
import { AdminStore } from '../../admin.store';
import { AdminPanelComponent } from '../../panel/admin-panel';
import { UserSheetComponent } from './user-sheet';

@Component({
  selector: 'app-admin-users-tab',
  imports: [
    DatePipe,
    FormsModule,
    HlmBadge,
    HlmButton,
    HlmInput,
    HlmTableImports,
    AdminPanelComponent,
    EmptyStateComponent,
    IconComponent,
    PagerComponent,
    UiSelectComponent,
    UserSheetComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.sinDatos()) {
      <fin-empty [title]="i18n.t('admin.emptyState.title')" [detail]="i18n.t('admin.emptyState.users.detail')" />
    } @else {
      <app-admin-panel [title]="i18n.t('admin.users.title')" [subtitle]="i18n.t('admin.users.subtitle')">
        <div panelActions class="flex flex-wrap items-center gap-2">
          <label class="relative">
            <fin-icon
              name="search"
              class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              hlmInput
              class="w-72 ps-9"
              [ngModel]="search()"
              (ngModelChange)="onSearch($event)"
              [placeholder]="i18n.t('admin.users.searchPlaceholder')"
              [attr.aria-label]="i18n.t('admin.users.searchPlaceholder')"
            />
          </label>
          <fin-select
            class="w-56"
            [ngModel]="organization()"
            (ngModelChange)="organization.set($event)"
            [options]="organizationOptions()"
            [ariaLabel]="i18n.t('admin.roles.filter.ariaLabel')"
          />
          <fin-select
            class="w-44"
            [ngModel]="status()"
            (ngModelChange)="status.set($event)"
            [options]="statusOptions()"
            [ariaLabel]="i18n.t('admin.users.statusFilterAriaLabel')"
          />
        </div>
        <div hlmTableContainer>
          <table hlmTable [attr.aria-label]="i18n.t('admin.users.title')">
            <thead hlmTHead class="bg-muted/40">
              <tr hlmTr>
                <th hlmTh class="h-11 px-5">{{ i18n.t('admin.users.column.user') }}</th>
                <th hlmTh class="px-4">{{ i18n.t('admin.roles.drawer.organizationLabel') }}</th>
                <th hlmTh class="px-4">{{ i18n.t('admin.users.column.status') }}</th>
                <th hlmTh class="px-4">{{ i18n.t('admin.users.column.roles') }}</th>
                <th hlmTh class="px-4">{{ i18n.t('admin.users.column.capabilities') }}</th>
                <th hlmTh class="px-4">{{ i18n.t('admin.users.column.lastAccess') }}</th>
                <th hlmTh class="w-32 px-5">
                  <span class="sr-only">{{ i18n.t('admin.common.actions') }}</span>
                </th>
              </tr>
            </thead>
            <tbody hlmTBody>
              @for (user of visibleUsers(); track user.id) {
                <tr hlmTr>
                  <td hlmTd class="px-5 py-3">
                    <div class="flex items-center gap-3">
                      <span
                        class="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-primary"
                      >
                        {{ labels.initials(user.displayName) }}
                      </span>
                      <div class="flex min-w-0 flex-col">
                        <b class="truncate text-sm">{{ user.displayName }}</b>
                        <small class="truncate text-xs text-muted-foreground">{{ user.email }}</small>
                      </div>
                    </div>
                  </td>
                  <td hlmTd class="px-4">
                    {{ organizationName(user) }}
                    @if (store.hasPendingMove(user)) {
                      <span hlmBadge variant="secondary" class="ms-1">{{ i18n.t('admin.common.unsaved') }}</span>
                    }
                  </td>
                  <td hlmTd class="px-4">
                    <span hlmBadge [variant]="store.isUserActive(user) ? 'secondary' : 'outline'">
                      {{
                        store.isUserActive(user)
                          ? i18n.t('admin.users.state.active')
                          : i18n.t('admin.users.state.inactive')
                      }}
                    </span>
                    @if (store.userHasChanges(user) && !store.hasPendingMove(user)) {
                      <span hlmBadge variant="secondary" class="ms-1">{{ i18n.t('admin.common.unsaved') }}</span>
                    }
                  </td>
                  <td hlmTd class="px-4">{{ user.roles.join(', ') || i18n.t('admin.users.directAccess') }}</td>
                  <td hlmTd class="px-4">{{ user.capabilities.length }} {{ i18n.t('admin.users.assignedSuffix') }}</td>
                  <td hlmTd class="px-4">
                    {{ user.lastSeenAt ? (user.lastSeenAt | date: 'dd MMM, HH:mm') : i18n.t('admin.users.noAccess') }}
                  </td>
                  <td hlmTd class="px-5 text-end">
                    @if (caps.allows(P.administracion.usuarios.editar)) {
                      <button
                        hlmBtn
                        variant="outline"
                        size="sm"
                        [attr.aria-label]="i18n.t('admin.users.manageAriaLabel') + ': ' + user.displayName"
                        (click)="selectedId.set(user.id)"
                      >
                        {{ i18n.t('admin.organizations.manage') }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr hlmTr>
                  <td hlmTd colspan="7" class="py-10 text-center text-muted-foreground">{{ i18n.t('table.empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <fin-pager
          class="border-t border-border px-5 py-3"
          [page]="store.usersPage()"
          [size]="store.usersSize"
          [total]="store.usersTotal()"
          [summary]="i18n.t('admin.users.countLabel', { count: visibleUsers().length })"
          (pageChange)="store.cargarUsuarios($event)"
        />
      </app-admin-panel>
    }
    <app-user-sheet [user]="selected()" (closed)="selectedId.set(null)" />
  `,
})
export class UsersTabComponent {
  readonly store = inject(AdminStore);
  readonly i18n = inject(I18nService);
  readonly labels = inject(AdminLabels);
  readonly caps = inject(CAPABILITIES);
  readonly P = P;

  readonly search = signal(this.store.userSearch());
  readonly status = signal('all');
  readonly organization = signal('');
  readonly selectedId = signal<string | null>(null);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  readonly statusOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('admin.users.status.all') },
    { value: 'active', label: this.i18n.t('admin.users.status.active') },
    { value: 'inactive', label: this.i18n.t('admin.users.status.inactive') },
  ]);

  readonly organizationOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('admin.roles.filter.all') },
    ...this.store.organizations().map((org) => ({ value: org.id, label: org.name })),
  ]);

  readonly visibleUsers = computed(() =>
    this.store
      .users()
      .filter((user) => this.status() === 'all' || (this.status() === 'active') === this.store.isUserActive(user))
      .filter((user) => !this.organization() || this.store.targetOrganizationId(user) === this.organization()),
  );

  organizationName(user: ApiAdminUser): string {
    const id = this.store.targetOrganizationId(user);
    return this.store.organizations().find((org) => org.id === id)?.name ?? '—';
  }

  readonly selected = computed<ApiAdminUser | null>(
    () => this.store.users().find((user) => user.id === this.selectedId()) ?? null,
  );

  onSearch(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.store.cargarUsuarios(1, value.trim()), 300);
  }
}
