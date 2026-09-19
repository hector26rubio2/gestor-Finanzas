import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { ApiAuditEvent, ApiAuditFilter } from '../../../../core/api/administration.api';
import { I18nService } from '../../../../core/i18n';
import { EmptyStateComponent } from '../../../../ui/empty-state/empty-state';
import { IconComponent } from '../../../../ui/icon';
import { PagerComponent } from '../../../../ui/pager/pager';
import { SheetPanelComponent } from '../../../../ui/sheet-panel/sheet-panel';
import { UiOption, UiSelectComponent } from '../../../../ui/select';
import { AdminStore } from '../../admin.store';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, endOfDayIso, prettyJson, startOfDayIso } from './audit-catalog';

@Component({
  selector: 'app-admin-audit-tab',
  imports: [
    DatePipe,
    FormsModule,
    HlmButton,
    HlmInput,
    HlmLabel,
    HlmTableImports,
    EmptyStateComponent,
    IconComponent,
    PagerComponent,
    SheetPanelComponent,
    UiSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.sinDatos()) {
      <fin-empty [title]="i18n.t('admin.emptyState.title')" [detail]="i18n.t('admin.emptyState.audit.detail')" />
    } @else {
      <section class="rounded-xl border border-border bg-card">
        <header class="flex flex-col gap-3 p-4">
          <div>
            <h2 class="text-base font-semibold">{{ i18n.t('admin.audit.title') }}</h2>
            <p class="text-sm text-muted-foreground">{{ i18n.t('admin.audit.subtitle') }}</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <fin-select
              [ngModel]="action()"
              (ngModelChange)="update('action', $event)"
              [options]="actionOptions()"
              [ariaLabel]="i18n.t('admin.audit.actionFilterAriaLabel')"
            />
            <fin-select
              [ngModel]="entityType()"
              (ngModelChange)="update('entityType', $event)"
              [options]="entityOptions()"
              [ariaLabel]="i18n.t('admin.audit.entityFilterAriaLabel')"
            />
            <fin-select
              [ngModel]="actor()"
              (ngModelChange)="update('actor', $event)"
              [options]="actorOptions()"
              [ariaLabel]="i18n.t('admin.audit.actorFilterAriaLabel')"
            />
            <label hlmLabel class="flex items-start flex-col gap-1">
              <span class="text-xs text-muted-foreground">{{ i18n.t('admin.audit.from') }}</span>
              <input hlmInput type="date" [ngModel]="from()" (ngModelChange)="update('from', $event)" />
            </label>
            <label hlmLabel class="flex items-start flex-col gap-1">
              <span class="text-xs text-muted-foreground">{{ i18n.t('admin.audit.to') }}</span>
              <input hlmInput type="date" [ngModel]="to()" (ngModelChange)="update('to', $event)" />
            </label>
          </div>
          @if (hasFilters()) {
            <div>
              <button hlmBtn variant="ghost" size="sm" (click)="clear()">
                {{ i18n.t('admin.audit.clearFilters') }}
              </button>
            </div>
          }
        </header>
        <div hlmTableContainer>
          <table hlmTable [attr.aria-label]="i18n.t('admin.audit.title')">
            <thead hlmTHead>
              <tr hlmTr>
                <th hlmTh>{{ i18n.t('admin.audit.column.date') }}</th>
                <th hlmTh>{{ i18n.t('admin.audit.column.actor') }}</th>
                <th hlmTh>{{ i18n.t('admin.audit.column.action') }}</th>
                <th hlmTh>{{ i18n.t('admin.audit.column.entity') }}</th>
                <th hlmTh>{{ i18n.t('admin.common.traceId') }}</th>
                <th hlmTh class="w-12"></th>
              </tr>
            </thead>
            <tbody hlmTBody>
              @for (event of store.audit(); track event.id) {
                <tr hlmTr>
                  <td hlmTd class="whitespace-nowrap">{{ event.createdAt | date: 'dd/MM/yy HH:mm' }}</td>
                  <td hlmTd>{{ actorName(event) }}</td>
                  <td hlmTd>
                    <b class="text-sm">{{ event.action }}</b>
                  </td>
                  <td hlmTd>
                    {{ event.entityType }}
                    <small class="block text-xs text-muted-foreground">{{ event.entityId || '—' }}</small>
                  </td>
                  <td hlmTd>
                    <code class="text-xs">{{ event.traceId.slice(0, 12) }}</code>
                  </td>
                  <td hlmTd>
                    <button
                      hlmBtn
                      variant="ghost"
                      size="icon-sm"
                      [attr.aria-label]="i18n.t('admin.audit.detail') + ': ' + event.action"
                      (click)="selected.set(event)"
                    >
                      <fin-icon name="next" />
                    </button>
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
          [page]="store.auditPage()"
          [size]="store.auditSize"
          [total]="store.auditTotal()"
          [summary]="i18n.t('admin.audit.countLabel', { count: store.auditTotal() })"
          (pageChange)="store.cargarAuditoria($event)"
        />
      </section>
    }
    <fin-sheet-panel
      [open]="!!selected()"
      [title]="selected()?.action ?? ''"
      [subtitle]="(selected()?.createdAt | date: 'medium') ?? ''"
      (closed)="selected.set(null)"
    >
      @if (selected(); as event) {
        <dl class="grid gap-3 text-sm">
          <div>
            <dt class="text-xs text-muted-foreground">{{ i18n.t('admin.audit.column.actor') }}</dt>
            <dd>{{ actorName(event) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ i18n.t('admin.audit.affected') }}</dt>
            <dd>{{ event.userId ? store.userName(event.userId) : '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ i18n.t('admin.audit.column.entity') }}</dt>
            <dd>{{ event.entityType }} / {{ event.entityId || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ i18n.t('admin.common.traceId') }}</dt>
            <dd>
              <code>{{ event.traceId }}</code>
            </dd>
          </div>
        </dl>
        <h3 class="text-sm font-semibold">{{ i18n.t('admin.audit.drawer.changesTitle') }}</h3>
        <pre class="overflow-x-auto rounded-lg bg-muted p-3 text-xs">{{
          changes(event) || i18n.t('admin.audit.drawer.noChanges')
        }}</pre>
      }
    </fin-sheet-panel>
  `,
})
export class AuditTabComponent {
  readonly store = inject(AdminStore);
  readonly i18n = inject(I18nService);

  readonly action = signal(this.store.auditFilter().action ?? '');
  readonly entityType = signal(this.store.auditFilter().entityType ?? '');
  readonly actor = signal(this.store.auditFilter().actorUserId ?? '');
  readonly from = signal('');
  readonly to = signal('');
  readonly selected = signal<ApiAuditEvent | null>(null);

  readonly actionOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('admin.audit.action.all') },
    ...AUDIT_ACTIONS.map((value) => ({ value, label: value })),
  ]);
  readonly entityOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('admin.audit.entity.all') },
    ...AUDIT_ENTITIES.map((value) => ({ value, label: value })),
  ]);
  readonly actorOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('admin.audit.actor.all') },
    ...this.store.users().map((user) => ({ value: user.id, label: user.displayName, description: user.email })),
  ]);
  readonly hasFilters = computed(
    () => !!(this.action() || this.entityType() || this.actor() || this.from() || this.to()),
  );

  update(field: 'action' | 'entityType' | 'actor' | 'from' | 'to', value: string): void {
    this[field].set(value);
    void this.store.cargarAuditoria(1, this.filter());
  }

  clear(): void {
    this.action.set('');
    this.entityType.set('');
    this.actor.set('');
    this.from.set('');
    this.to.set('');
    void this.store.cargarAuditoria(1, {});
  }

  actorName(event: ApiAuditEvent): string {
    return event.actorUserId ? this.store.userName(event.actorUserId) : this.i18n.t('admin.audit.systemActor');
  }

  changes(event: ApiAuditEvent): string {
    return prettyJson(event.changesJson);
  }

  private filter(): ApiAuditFilter {
    return {
      action: this.action() || undefined,
      entityType: this.entityType() || undefined,
      actorUserId: this.actor() || undefined,
      from: startOfDayIso(this.from()),
      to: endOfDayIso(this.to()),
    };
  }
}
