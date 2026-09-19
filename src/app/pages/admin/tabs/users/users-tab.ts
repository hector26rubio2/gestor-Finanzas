import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { ApiAdminUser } from '../../../../core/api/administration.api';
import { I18nService } from '../../../../core/i18n';
import { P } from '../../../../core/permissions';
import { CAPABILITIES } from '../../../../core/store';
import { EmptyStateComponent } from '../../../../ui/empty-state/empty-state';
import { IconComponent } from '../../../../ui/icon';
import { PagerComponent } from '../../../../ui/pager/pager';
import { UiOption, UiSelectComponent } from '../../../../ui/select';
import { AdminLabels } from '../../admin-labels';
import { AdminStore } from '../../admin.store';
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
      <section class="rounded-xl border border-border bg-card">
        <header class="flex flex-wrap items-end justify-between gap-3 p-4">
          <div>
            <h2 class="text-base font-semibold">{{ i18n.t('admin.users.title') }}</h2>
            <p class="text-sm text-muted-foreground">{{ i18n.t('admin.users.subtitle') }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <label class="relative">
              <fin-icon
                name="search"
                class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                hlmInput
                class="w-64 ps-9"
                [ngModel]="search()"
                (ngModelChange)="onSearch($event)"
                [placeholder]="i18n.t('admin.users.searchPlaceholder')"
                [attr.aria-label]="i18n.t('admin.users.searchPlaceholder')"
              />
            </label>
            <fin-select
              class="w-44"
              [ngModel]="status()"
              (ngModelChange)="status.set($event)"
              [options]="statusOptions()"
              [ariaLabel]="i18n.t('admin.users.statusFilterAriaLabel')"
            />
          </div>
        </header>
        <div hlmTableContainer>
          <table hlmTable [attr.aria-label]="i18n.t('admin.users.title')">
            <thead hlmTHead>
              <tr hlmTr>
                <th hlmTh>{{ i18n.t('admin.users.column.user') }}</th>
                <th hlmTh>{{ i18n.t('admin.users.column.status') }}</th>
                <th hlmTh>{{ i18n.t('admin.users.column.roles') }}</th>
                <th hlmTh>{{ i18n.t('admin.users.column.capabilities') }}</th>
                <th hlmTh>{{ i18n.t('admin.users.column.lastAccess') }}</th>
                <th hlmTh class="w-12"></th>
              </tr>
            </thead>
            <tbody hlmTBody>
              @for (user of visibleUsers(); track user.id) {
                <tr hlmTr>
                  <td hlmTd>
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
                  <td hlmTd>
                    <span hlmBadge [variant]="store.isUserActive(user) ? 'secondary' : 'outline'">
                      {{
                        store.isUserActive(user)
                          ? i18n.t('admin.users.state.active')
                          : i18n.t('admin.users.state.inactive')
                      }}
                    </span>
                    @if (store.userHasChanges(user)) {
                      <span hlmBadge variant="secondary" class="ms-1">{{ i18n.t('admin.common.unsaved') }}</span>
                    }
                  </td>
                  <td hlmTd>{{ user.roles.join(', ') || i18n.t('admin.users.directAccess') }}</td>
                  <td hlmTd>{{ user.capabilities.length }} {{ i18n.t('admin.users.assignedSuffix') }}</td>
                  <td hlmTd class="whitespace-nowrap">
                    {{ user.lastSeenAt ? (user.lastSeenAt | date: 'dd MMM, HH:mm') : i18n.t('admin.users.noAccess') }}
                  </td>
                  <td hlmTd>
                    @if (caps.allows(P.administracion.usuarios.editar)) {
                      <button
                        hlmBtn
                        variant="ghost"
                        size="icon-sm"
                        [attr.aria-label]="i18n.t('admin.users.manageAriaLabel') + ': ' + user.displayName"
                        (click)="selectedId.set(user.id)"
                      >
                        <fin-icon name="next" />
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr hlmTr>
                  <td hlmTd colspan="6" class="py-8 text-center text-muted-foreground">{{ i18n.t('table.empty') }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <fin-pager
          class="p-4"
          [page]="store.usersPage()"
          [size]="store.usersSize"
          [total]="store.usersTotal()"
          [summary]="i18n.t('admin.users.countLabel', { count: store.usersTotal() })"
          (pageChange)="store.cargarUsuarios($event)"
        />
      </section>
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
  readonly selectedId = signal<string | null>(null);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  readonly statusOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('admin.users.status.all') },
    { value: 'active', label: this.i18n.t('admin.users.status.active') },
    { value: 'inactive', label: this.i18n.t('admin.users.status.inactive') },
  ]);

  readonly visibleUsers = computed(() =>
    this.store.users().filter((user) => this.status() === 'all' || (this.status() === 'active') === user.isActive),
  );

  readonly selected = computed<ApiAdminUser | null>(
    () => this.store.users().find((user) => user.id === this.selectedId()) ?? null,
  );

  onSearch(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.store.cargarUsuarios(1, value.trim()), 300);
  }
}
