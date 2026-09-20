import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { ApiAdminUser } from '../../../../core/api/administration.api';
import { I18nService } from '../../../../core/i18n';
import { P } from '../../../../core/session/permissions';
import { CAPABILITIES } from '../../../../core/state/store';
import { EmptyStateComponent } from '../../../../ui/empty-state/empty-state';
import { IconComponent } from '../../../../ui/icon/icon';
import { PagerComponent } from '../../../../ui/pager/pager';
import { DataTableComponent, TableColumn } from '../../../../ui/data-table/data-table';
import { FinTableCellDirective } from '../../../../ui/data-table/table-cell.directive';
import { AdminLabels } from '../../admin-labels';
import { AdminStore } from '../../admin.store';
import { AdminGridComponent } from '../../panel/admin-grid';
import { AdminPanelComponent } from '../../panel/admin-panel';
import { UserSheetComponent } from './user-sheet';

@Component({
  selector: 'app-admin-users-tab',
  imports: [
    HlmBadge,
    HlmButton,
    AdminGridComponent,
    AdminPanelComponent,
    DataTableComponent,
    FinTableCellDirective,
    EmptyStateComponent,
    IconComponent,
    PagerComponent,
    UserSheetComponent,
  ],
  host: { class: 'flex min-w-0 flex-col gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.sinDatos()) {
      <fin-empty [title]="i18n.t('admin.emptyState.title')" [detail]="i18n.t('admin.emptyState.users.detail')" />
    } @else {
      <app-admin-panel [title]="i18n.t('admin.users.title')" [subtitle]="i18n.t('admin.users.subtitle')">
        <app-admin-grid>
          <fin-table
            [columns]="columns()"
            [rows]="rows()"
            [pageSize]="15"
            [tableLabel]="i18n.t('admin.users.title')"
            (rowSelected)="open($event['id'])"
          >
            <ng-template finCell="user" let-row>
              <div class="flex items-center gap-3">
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-primary"
                >
                  {{ labels.initials(row.raw.displayName) }}
                </span>
                <div class="flex min-w-0 flex-col">
                  <b class="truncate text-sm">{{ row.raw.displayName }}</b>
                  <small class="truncate text-xs text-muted-foreground">{{ row.raw.email }}</small>
                </div>
              </div>
            </ng-template>
            <ng-template finCell="organization" let-row>
              {{ row.organization }}
              @if (store.hasPendingMove(row.raw)) {
                <span hlmBadge variant="secondary" class="ms-1">{{ i18n.t('admin.common.unsaved') }}</span>
              }
            </ng-template>
            <ng-template finCell="status" let-row>
              <span hlmBadge [variant]="store.isUserActive(row.raw) ? 'secondary' : 'outline'">{{ row.status }}</span>
              @if (store.userHasChanges(row.raw) && !store.hasPendingMove(row.raw)) {
                <span hlmBadge variant="secondary" class="ms-1">{{ i18n.t('admin.common.unsaved') }}</span>
              }
            </ng-template>
            <ng-template finCell="actions" let-row>
              @if (caps.allows(P.administracion.usuarios.editar)) {
                <button
                  hlmBtn
                  variant="outline"
                  size="sm"
                  [attr.aria-label]="i18n.t('admin.users.manageAriaLabel') + ': ' + row.raw.displayName"
                  (click)="$event.stopPropagation(); open(row.id)"
                >
                  <fin-icon name="edit" /> {{ i18n.t('admin.organizations.manage') }}
                </button>
              }
            </ng-template>
          </fin-table>
        </app-admin-grid>
        @if (store.usersTotal() > store.usersSize) {
          <fin-pager
            class="border-t border-border px-5 py-3"
            [page]="store.usersPage()"
            [size]="store.usersSize"
            [total]="store.usersTotal()"
            [summary]="i18n.t('admin.users.countLabel', { count: store.users().length })"
            (pageChange)="store.cargarUsuarios($event)"
          />
        }
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

  readonly selectedId = signal<string | null>(null);

  readonly columns = computed<TableColumn[]>(() => [
    { key: 'user', label: this.i18n.t('admin.users.column.user') },
    { key: 'organization', label: this.i18n.t('admin.roles.drawer.organizationLabel'), facet: true },
    { key: 'status', label: this.i18n.t('admin.users.column.status'), facet: true },
    { key: 'roles', label: this.i18n.t('admin.users.column.roles'), facet: true },
    {
      key: 'capabilities',
      label: this.i18n.t('admin.users.column.capabilities'),
      essential: false,
      hidden: true,
    },
    {
      key: 'lastAccess',
      label: this.i18n.t('admin.users.column.lastAccess'),
      sortKey: 'lastAccessSort',
      essential: false,
    },
    { key: 'actions', label: this.i18n.t('admin.common.actions'), sortable: false, hideable: false },
  ]);

  readonly rows = computed(() =>
    this.store.users().map((user) => ({
      id: user.id,
      user: `${user.displayName} ${user.email}`,
      organization: this.organizationName(user),
      status: this.store.isUserActive(user)
        ? this.i18n.t('admin.users.state.active')
        : this.i18n.t('admin.users.state.inactive'),
      roles: user.roles.join(', ') || this.i18n.t('admin.users.directAccess'),
      capabilities: `${user.capabilities.length} ${this.i18n.t('admin.users.assignedSuffix')}`,
      lastAccess: user.lastSeenAt ? this.labels.dateTime(user.lastSeenAt) : this.i18n.t('admin.users.noAccess'),
      lastAccessSort: user.lastSeenAt ?? '',
      raw: user,
    })),
  );

  open(id: string): void {
    if (this.caps.allows(P.administracion.usuarios.editar)) this.selectedId.set(id);
  }

  organizationName(user: ApiAdminUser): string {
    const id = this.store.targetOrganizationId(user);
    return this.store.organizations().find((org) => org.id === id)?.name ?? '—';
  }

  readonly selected = computed<ApiAdminUser | null>(
    () => this.store.users().find((user) => user.id === this.selectedId()) ?? null,
  );
}
