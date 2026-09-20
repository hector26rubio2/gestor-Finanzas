import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { I18nService } from '../../../../core/i18n';
import { EmptyStateComponent } from '../../../../ui/empty-state/empty-state';
import { DataTableComponent, TableColumn } from '../../../../ui/data-table/data-table';
import { FinTableCellDirective } from '../../../../ui/data-table/table-cell.directive';
import { IconComponent, IconName } from '../../../../ui/icon/icon';
import { AdminLabels } from '../../admin-labels';
import { AdminStore } from '../../admin.store';
import { AdminGridComponent } from '../../panel/admin-grid';
import { AdminPanelComponent } from '../../panel/admin-panel';

interface SummaryKpi {
  label: string;
  value: number;
  detail: string;
  icon: IconName;
  warn: boolean;
}

@Component({
  selector: 'app-admin-summary-tab',
  imports: [
    HlmBadge,
    HlmButton,
    AdminGridComponent,
    AdminPanelComponent,
    DataTableComponent,
    FinTableCellDirective,
    EmptyStateComponent,
    IconComponent,
  ],
  host: { class: 'flex min-w-0 flex-col gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.sinDatos()) {
      <fin-empty [title]="i18n.t('admin.emptyState.title')" [detail]="i18n.t('admin.emptyState.summary.detail')" />
    } @else {
      <section class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        @for (kpi of kpis(); track kpi.label) {
          <article class="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4">
            <span
              class="grid size-11 shrink-0 place-items-center rounded-xl"
              [class]="kpi.warn ? 'bg-warning/15 text-warning' : 'bg-accent text-primary'"
            >
              <fin-icon [name]="kpi.icon" class="[--icon-size:22px]" />
            </span>
            <span class="flex min-w-0 flex-col">
              <span class="text-sm text-muted-foreground">{{ kpi.label }}</span>
              <strong class="text-2xl leading-tight font-semibold tabular-nums">{{ kpi.value }}</strong>
              <small class="text-xs text-muted-foreground">{{ kpi.detail }}</small>
            </span>
          </article>
        }
      </section>
      <app-admin-panel
        [title]="i18n.t('admin.summary.users.title')"
        [subtitle]="i18n.t('admin.summary.users.subtitle')"
      >
        <button panelActions hlmBtn variant="outline" size="sm" (click)="store.tab.set('users')">
          {{ i18n.t('admin.summary.accessControl.manage') }}
        </button>
        <app-admin-grid class="h-[24rem]!">
          <fin-table
            [columns]="userColumns()"
            [rows]="userRows()"
            [selectable]="false"
            [toolbar]="false"
            [pageSize]="6"
            [tableLabel]="i18n.t('admin.summary.users.title')"
          >
            <ng-template finCell="user" let-row>
              <div class="flex items-center gap-3">
                <span
                  class="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-primary"
                >
                  {{ labels.initials(row.raw.displayName) }}
                </span>
                <span class="flex min-w-0 flex-col">
                  <b class="truncate text-sm">{{ row.raw.displayName }}</b>
                  <small class="truncate text-xs text-muted-foreground">{{ row.raw.email }}</small>
                </span>
              </div>
            </ng-template>
            <ng-template finCell="status" let-row>
              <span hlmBadge [variant]="row.raw.isActive ? 'secondary' : 'outline'">{{ row.status }}</span>
            </ng-template>
          </fin-table>
        </app-admin-grid>
      </app-admin-panel>
      <section class="grid items-stretch gap-4 xl:grid-cols-2">
        <app-admin-panel
          [title]="i18n.t('admin.summary.organizations.title')"
          [subtitle]="i18n.t('admin.summary.organizations.subtitle')"
        >
          <button panelActions hlmBtn variant="outline" size="sm" (click)="store.tab.set('organizations')">
            {{ i18n.t('admin.summary.accessControl.manage') }}
          </button>
          <app-admin-grid class="h-[24rem]!">
            <fin-table
              [columns]="organizationColumns()"
              [rows]="organizationRows()"
              [selectable]="false"
              [toolbar]="false"
              [pageSize]="5"
              [tableLabel]="i18n.t('admin.summary.organizations.title')"
            >
              <ng-template finCell="organization" let-row>
                <b class="text-sm">{{ row.raw.name }}</b>
                @if (row.raw.isDefault) {
                  <span hlmBadge class="ms-2">{{ i18n.t('admin.organizations.defaultBadge') }}</span>
                }
              </ng-template>
              <ng-template finCell="status" let-row>
                <span hlmBadge [variant]="row.raw.isActive ? 'secondary' : 'outline'">{{ row.status }}</span>
              </ng-template>
            </fin-table>
          </app-admin-grid>
        </app-admin-panel>
        <app-admin-panel
          [title]="i18n.t('admin.summary.recentActivity.title')"
          [subtitle]="i18n.t('admin.summary.recentActivity.subtitle')"
        >
          <button panelActions hlmBtn variant="outline" size="sm" (click)="store.tab.set('audit')">
            {{ i18n.t('admin.summary.recentActivity.viewAudit') }}
          </button>
          <app-admin-grid class="h-[24rem]!">
            <fin-table
              [columns]="activityColumns()"
              [rows]="activityRows()"
              [selectable]="false"
              [toolbar]="false"
              [pageSize]="5"
              [tableLabel]="i18n.t('admin.summary.recentActivity.title')"
            >
              <ng-template finCell="trace" let-row>
                <code class="text-xs text-muted-foreground">{{ row.trace }}</code>
              </ng-template>
            </fin-table>
          </app-admin-grid>
        </app-admin-panel>
      </section>
    }
  `,
})
export class SummaryTabComponent {
  readonly store = inject(AdminStore);
  readonly i18n = inject(I18nService);
  readonly labels = inject(AdminLabels);

  readonly kpis = computed<readonly SummaryKpi[]>(() => {
    const users = this.store.users();
    const organizations = this.store.organizations();
    const flags = this.store.platformFlags();
    const open = this.store.errors().filter((error) => error.status !== 'resolved');
    return [
      {
        label: this.i18n.t('admin.summary.activeUsers.label'),
        value: users.filter((user) => user.isActive).length,
        detail: this.i18n.t('admin.summary.activeUsers.detail', { total: users.length }),
        icon: 'people',
        warn: false,
      },
      {
        label: this.i18n.t('admin.summary.organizationsKpi.label'),
        value: organizations.filter((org) => org.isActive).length,
        detail: this.i18n.t('admin.summary.activeUsers.detail', { total: organizations.length }),
        icon: 'organization',
        warn: false,
      },
      {
        label: this.i18n.t('admin.summary.roles.label'),
        value: this.store.rolesTotal(),
        detail: this.i18n.t('admin.summary.roles.detail', { count: this.store.permissionCatalog().length }),
        icon: 'shield',
        warn: false,
      },
      {
        label: this.i18n.t('admin.summary.flags.label'),
        value: flags.filter((flag) => flag.isEnabled).length,
        detail: this.i18n.t('admin.summary.flags.detail', { total: flags.length }),
        icon: 'flag',
        warn: false,
      },
      {
        label: this.i18n.t('admin.summary.errors.label'),
        value: open.length,
        detail: this.i18n.t('admin.summary.errors.detail', {
          count: open.reduce((total, error) => total + error.occurrences, 0),
        }),
        icon: 'notifications',
        warn: open.length > 0,
      },
    ];
  });

  readonly userColumns = computed<TableColumn[]>(() => [
    { key: 'user', label: this.i18n.t('admin.users.column.user') },
    { key: 'organization', label: this.i18n.t('admin.roles.drawer.organizationLabel') },
    { key: 'roles', label: this.i18n.t('admin.users.column.roles'), essential: false },
    { key: 'status', label: this.i18n.t('admin.users.column.status') },
    { key: 'lastAccess', label: this.i18n.t('admin.users.column.lastAccess'), essential: false },
  ]);

  readonly userRows = computed(() =>
    this.store.users().map((user) => ({
      id: user.id,
      user: `${user.displayName} ${user.email}`,
      organization: this.organizationOf(user.id),
      roles: user.roles.join(', ') || this.i18n.t('admin.users.directAccess'),
      status: user.isActive ? this.i18n.t('admin.users.state.active') : this.i18n.t('admin.users.state.inactive'),
      lastAccess: user.lastSeenAt ? this.labels.dateTime(user.lastSeenAt) : this.i18n.t('admin.users.noAccess'),
      raw: user,
    })),
  );

  readonly organizationColumns = computed<TableColumn[]>(() => [
    { key: 'organization', label: this.i18n.t('admin.organizations.column.organization') },
    { key: 'members', label: this.i18n.t('admin.organizations.column.members') },
    { key: 'roles', label: this.i18n.t('admin.organizations.column.roles'), essential: false },
    { key: 'status', label: this.i18n.t('admin.organizations.column.active') },
  ]);

  readonly organizationRows = computed(() =>
    this.store.organizations().map((org) => ({
      id: org.id,
      organization: org.name,
      members: org.memberCount,
      roles: this.store.roleCountOf(org.id),
      status: org.isActive ? this.i18n.t('admin.users.state.active') : this.i18n.t('admin.organizations.inactiveBadge'),
      raw: org,
    })),
  );

  readonly activityColumns = computed<TableColumn[]>(() => [
    { key: 'action', label: this.i18n.t('admin.summary.column.action') },
    { key: 'entity', label: this.i18n.t('admin.summary.column.entity') },
    { key: 'date', label: this.i18n.t('admin.summary.column.date') },
    { key: 'trace', label: this.i18n.t('admin.summary.column.trace'), essential: false },
  ]);

  readonly activityRows = computed(() =>
    this.store.audit().map((event) => ({
      id: event.id,
      action: this.labels.auditAction(event.action),
      entity: this.labels.auditEntity(event.entityType),
      date: this.labels.dateTime(event.createdAt),
      trace: event.traceId.slice(0, 8),
    })),
  );

  organizationOf(userId: string): string {
    const user = this.store.users().find((candidate) => candidate.id === userId);
    const id = user ? this.store.targetOrganizationId(user) : undefined;
    return this.store.organizations().find((org) => org.id === id)?.name ?? '—';
  }
}
