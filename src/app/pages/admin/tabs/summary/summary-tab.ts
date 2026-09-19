import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { I18nService } from '../../../../core/i18n';
import { EmptyStateComponent } from '../../../../ui/empty-state/empty-state';
import { IconComponent, IconName } from '../../../../ui/icon/icon';
import { AdminLabels } from '../../admin-labels';
import { AdminStore } from '../../admin.store';
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
  imports: [DatePipe, HlmBadge, HlmButton, HlmTableImports, AdminPanelComponent, EmptyStateComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.sinDatos()) {
      <fin-empty [title]="i18n.t('admin.emptyState.title')" [detail]="i18n.t('admin.emptyState.summary.detail')" />
    } @else {
      <section class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
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
        <div hlmTableContainer tabindex="0">
          <table hlmTable [attr.aria-label]="i18n.t('admin.summary.users.title')">
            <thead hlmTHead class="bg-muted/40">
              <tr hlmTr>
                <th hlmTh class="h-11 px-5">{{ i18n.t('admin.users.column.user') }}</th>
                <th hlmTh class="px-4">{{ i18n.t('admin.roles.drawer.organizationLabel') }}</th>
                <th hlmTh class="px-4">{{ i18n.t('admin.users.column.roles') }}</th>
                <th hlmTh class="px-4">{{ i18n.t('admin.users.column.status') }}</th>
                <th hlmTh class="px-5">{{ i18n.t('admin.users.column.lastAccess') }}</th>
              </tr>
            </thead>
            <tbody hlmTBody>
              @for (user of store.users().slice(0, 10); track user.id) {
                <tr hlmTr>
                  <td hlmTd class="px-5 py-3">
                    <div class="flex items-center gap-3">
                      <span
                        class="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-primary"
                      >
                        {{ labels.initials(user.displayName) }}
                      </span>
                      <span class="flex min-w-0 flex-col">
                        <b class="truncate text-sm">{{ user.displayName }}</b>
                        <small class="truncate text-xs text-muted-foreground">{{ user.email }}</small>
                      </span>
                    </div>
                  </td>
                  <td hlmTd class="px-4">{{ organizationOf(user.id) }}</td>
                  <td hlmTd class="px-4">{{ user.roles.join(', ') || i18n.t('admin.users.directAccess') }}</td>
                  <td hlmTd class="px-4">
                    <span hlmBadge [variant]="user.isActive ? 'secondary' : 'outline'">
                      {{ user.isActive ? i18n.t('admin.users.state.active') : i18n.t('admin.users.state.inactive') }}
                    </span>
                  </td>
                  <td hlmTd class="px-5">
                    {{ user.lastSeenAt ? (user.lastSeenAt | date: 'dd MMM, HH:mm') : i18n.t('admin.users.noAccess') }}
                  </td>
                </tr>
              } @empty {
                <tr hlmTr>
                  <td hlmTd colspan="5" class="py-10 text-center text-muted-foreground">
                    {{ i18n.t('table.empty') }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </app-admin-panel>
      <section class="grid items-start gap-4 xl:grid-cols-2">
        <app-admin-panel
          [title]="i18n.t('admin.summary.organizations.title')"
          [subtitle]="i18n.t('admin.summary.organizations.subtitle')"
        >
          <button panelActions hlmBtn variant="outline" size="sm" (click)="store.tab.set('organizations')">
            {{ i18n.t('admin.summary.accessControl.manage') }}
          </button>
          <div hlmTableContainer tabindex="0">
            <table hlmTable [attr.aria-label]="i18n.t('admin.summary.organizations.title')">
              <thead hlmTHead class="bg-muted/40">
                <tr hlmTr>
                  <th hlmTh class="h-11 px-5">{{ i18n.t('admin.organizations.column.organization') }}</th>
                  <th hlmTh class="px-4">{{ i18n.t('admin.organizations.column.members') }}</th>
                  <th hlmTh class="px-4">{{ i18n.t('admin.organizations.column.roles') }}</th>
                  <th hlmTh class="px-5">{{ i18n.t('admin.organizations.column.active') }}</th>
                </tr>
              </thead>
              <tbody hlmTBody>
                @for (org of store.organizations(); track org.id) {
                  <tr hlmTr>
                    <td hlmTd class="px-5 py-3">
                      <b class="text-sm">{{ org.name }}</b>
                      @if (org.isDefault) {
                        <span hlmBadge class="ms-2">{{ i18n.t('admin.organizations.defaultBadge') }}</span>
                      }
                    </td>
                    <td hlmTd class="px-4 tabular-nums">{{ org.memberCount }}</td>
                    <td hlmTd class="px-4 tabular-nums">{{ store.roleCountOf(org.id) }}</td>
                    <td hlmTd class="px-5">
                      <span hlmBadge [variant]="org.isActive ? 'secondary' : 'outline'">
                        {{
                          org.isActive
                            ? i18n.t('admin.users.state.active')
                            : i18n.t('admin.organizations.inactiveBadge')
                        }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </app-admin-panel>
        <app-admin-panel
          [title]="i18n.t('admin.summary.recentActivity.title')"
          [subtitle]="i18n.t('admin.summary.recentActivity.subtitle')"
        >
          <button panelActions hlmBtn variant="outline" size="sm" (click)="store.tab.set('audit')">
            {{ i18n.t('admin.summary.recentActivity.viewAudit') }}
          </button>
          <div hlmTableContainer tabindex="0">
            <table hlmTable [attr.aria-label]="i18n.t('admin.summary.recentActivity.title')">
              <thead hlmTHead class="bg-muted/40">
                <tr hlmTr>
                  <th hlmTh class="h-11 px-5">{{ i18n.t('admin.summary.column.action') }}</th>
                  <th hlmTh class="px-4">{{ i18n.t('admin.summary.column.entity') }}</th>
                  <th hlmTh class="px-4">{{ i18n.t('admin.summary.column.date') }}</th>
                  <th hlmTh class="px-5">{{ i18n.t('admin.summary.column.trace') }}</th>
                </tr>
              </thead>
              <tbody hlmTBody>
                @for (event of store.audit().slice(0, 8); track event.id) {
                  <tr hlmTr>
                    <td hlmTd class="px-5 py-3 font-medium">{{ event.action }}</td>
                    <td hlmTd class="px-4">{{ event.entityType }}</td>
                    <td hlmTd class="px-4">{{ event.createdAt | date: 'dd MMM, HH:mm' }}</td>
                    <td hlmTd class="px-5">
                      <code class="text-xs text-muted-foreground">{{ event.traceId.slice(0, 8) }}</code>
                    </td>
                  </tr>
                } @empty {
                  <tr hlmTr>
                    <td hlmTd colspan="4" class="py-10 text-center text-muted-foreground">
                      {{ i18n.t('table.empty') }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
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

  organizationOf(userId: string): string {
    const user = this.store.users().find((candidate) => candidate.id === userId);
    const id = user ? this.store.targetOrganizationId(user) : undefined;
    return this.store.organizations().find((org) => org.id === id)?.name ?? '—';
  }
}
