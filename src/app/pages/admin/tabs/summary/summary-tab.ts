import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmProgressImports } from '@spartan-ng/helm/progress';
import { I18nService } from '../../../../core/i18n';
import { EmptyStateComponent } from '../../../../ui/empty-state/empty-state';
import { AdminStore } from '../../admin.store';

@Component({
  selector: 'app-admin-summary-tab',
  imports: [DatePipe, HlmButton, HlmProgressImports, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.sinDatos()) {
      <fin-empty [title]="i18n.t('admin.emptyState.title')" [detail]="i18n.t('admin.emptyState.summary.detail')" />
    } @else {
      <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        @for (kpi of kpis(); track kpi.label) {
          <article class="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
            <span class="text-sm text-muted-foreground">{{ kpi.label }}</span>
            <strong class="text-3xl font-semibold" [class.text-warning]="kpi.warn">{{ kpi.value }}</strong>
            <small class="text-xs text-muted-foreground">{{ kpi.detail }}</small>
          </article>
        }
      </section>
      <section class="grid gap-4 lg:grid-cols-2">
        <article class="rounded-xl border border-border bg-card">
          <header class="flex items-start justify-between gap-3 p-4">
            <div>
              <h2 class="text-base font-semibold">{{ i18n.t('admin.summary.recentActivity.title') }}</h2>
              <p class="text-sm text-muted-foreground">{{ i18n.t('admin.summary.recentActivity.subtitle') }}</p>
            </div>
            <button hlmBtn variant="outline" size="sm" (click)="store.tab.set('audit')">
              {{ i18n.t('admin.summary.recentActivity.viewAudit') }}
            </button>
          </header>
          <ul class="divide-y divide-border">
            @for (event of store.audit().slice(0, 5); track event.id) {
              <li class="flex items-center justify-between gap-3 px-4 py-3">
                <span class="flex min-w-0 flex-col">
                  <b class="truncate text-sm">{{ event.action }}</b>
                  <small class="text-xs text-muted-foreground">
                    {{ event.entityType }} · {{ event.createdAt | date: 'dd MMM, HH:mm' }}
                  </small>
                </span>
                <code class="text-xs text-muted-foreground">{{ event.traceId.slice(0, 8) }}</code>
              </li>
            }
          </ul>
        </article>
        <article class="rounded-xl border border-border bg-card">
          <header class="flex items-start justify-between gap-3 p-4">
            <div>
              <h2 class="text-base font-semibold">{{ i18n.t('admin.summary.accessControl.title') }}</h2>
              <p class="text-sm text-muted-foreground">{{ i18n.t('admin.summary.accessControl.subtitle') }}</p>
            </div>
            <button hlmBtn variant="outline" size="sm" (click)="store.tab.set('users')">
              {{ i18n.t('admin.summary.accessControl.manage') }}
            </button>
          </header>
          <ul class="space-y-3 px-4 pb-4">
            @for (role of store.roles(); track role.id) {
              <li class="flex flex-col gap-1.5">
                <span class="flex flex-col">
                  <b class="text-sm">{{ role.name }}</b>
                  <small class="text-xs text-muted-foreground">
                    {{ role.organizationName }} ·
                    {{ i18n.t('admin.roles.memberCount', { count: memberCount(role.id) }) }}
                  </small>
                </span>
                <hlm-progress [value]="memberCount(role.id)" [max]="store.users().length || 1">
                  <hlm-progress-indicator />
                </hlm-progress>
              </li>
            }
          </ul>
        </article>
      </section>
    }
  `,
})
export class SummaryTabComponent {
  readonly store = inject(AdminStore);
  readonly i18n = inject(I18nService);

  readonly kpis = computed(() => {
    const users = this.store.users();
    const flags = this.store.flags();
    const open = this.store.errors().filter((error) => error.status !== 'resolved');
    return [
      {
        label: this.i18n.t('admin.summary.activeUsers.label'),
        value: users.filter((user) => user.isActive).length,
        detail: this.i18n.t('admin.summary.activeUsers.detail', { total: users.length }),
        warn: false,
      },
      {
        label: this.i18n.t('admin.summary.roles.label'),
        value: this.store.rolesTotal(),
        detail: this.i18n.t('admin.summary.roles.detail', { count: this.store.permissionCatalog().length }),
        warn: false,
      },
      {
        label: this.i18n.t('admin.summary.flags.label'),
        value: flags.filter((flag) => flag.isEnabled).length,
        detail: this.i18n.t('admin.summary.flags.detail', { total: flags.length }),
        warn: false,
      },
      {
        label: this.i18n.t('admin.summary.errors.label'),
        value: open.length,
        detail: this.i18n.t('admin.summary.errors.detail', {
          count: open.reduce((total, error) => total + error.occurrences, 0),
        }),
        warn: true,
      },
    ];
  });

  memberCount(roleId: string): number {
    return this.store.users().filter((user) => user.memberships?.some((m) => m.roles.some((r) => r.id === roleId)))
      .length;
  }
}
