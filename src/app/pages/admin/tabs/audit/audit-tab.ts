import { DateFieldComponent } from '../../../../ui/date-field/date-field';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { ApiAuditEvent, ApiAuditFilter } from '../../../../core/api/administration.api';
import { I18nService } from '../../../../core/i18n';
import { EmptyStateComponent } from '../../../../ui/empty-state/empty-state';
import { DataTableComponent, TableColumn } from '../../../../ui/data-table/data-table';
import { FinTableCellDirective } from '../../../../ui/data-table/table-cell.directive';
import { IconComponent } from '../../../../ui/icon/icon';
import { SheetPanelComponent } from '../../../../ui/sheet-panel/sheet-panel';
import { UiOption, UiSelectComponent } from '../../../../ui/select/select';
import { AdminLabels } from '../../admin-labels';
import { AdminStore } from '../../admin.store';
import { AdminGridComponent } from '../../panel/admin-grid';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, endOfDayIso, prettyJson, startOfDayIso } from './audit-catalog';

@Component({
  selector: 'app-admin-audit-tab',
  imports: [
    AdminGridComponent,
    DataTableComponent,
    FinTableCellDirective,
    DateFieldComponent,
    FormsModule,
    HlmButton,
    HlmInput,
    HlmLabel,
    EmptyStateComponent,
    IconComponent,
    SheetPanelComponent,
    UiSelectComponent,
  ],
  host: { class: 'flex min-w-0 flex-col gap-4' },
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
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
            <fin-select
              [ngModel]="affected()"
              (ngModelChange)="update('affected', $event)"
              [options]="affectedOptions()"
              [ariaLabel]="i18n.t('admin.audit.affectedFilterAriaLabel')"
            />
            <label hlmLabel class="flex items-start flex-col gap-1">
              <span class="text-xs text-muted-foreground">{{ i18n.t('admin.audit.from') }}</span>
              <fin-date-field [ngModel]="from()" (ngModelChange)="update('from', $event)" />
            </label>
            <label hlmLabel class="flex items-start flex-col gap-1">
              <span class="text-xs text-muted-foreground">{{ i18n.t('admin.audit.to') }}</span>
              <fin-date-field [ngModel]="to()" (ngModelChange)="update('to', $event)" />
            </label>
          </div>
          @if (traceId(); as trace) {
            <div
              class="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-accent px-3 py-2 text-sm"
            >
              <fin-icon name="filter" />
              <span>{{ i18n.t('admin.audit.trace.filtering', { trace: trace.slice(0, 12) }) }}</span>
              <button hlmBtn variant="ghost" size="sm" class="ms-auto" (click)="filterByTrace('')">
                <fin-icon name="close" /> {{ i18n.t('admin.audit.trace.remove') }}
              </button>
            </div>
          }
          @if (hasFilters()) {
            <div>
              <button hlmBtn variant="ghost" size="sm" (click)="clear()">
                <fin-icon name="close" /> {{ i18n.t('admin.audit.clearFilters') }}
              </button>
            </div>
          }
        </header>
        <app-admin-grid
          class="[height:max(22rem,calc(100dvh-26rem))]! max-[700px]:[height:min(34rem,calc(100dvh-12rem))]!"
        >
          <fin-table
            [columns]="columns()"
            [rows]="rows()"
            [totalRows]="store.auditTotal()"
            [remotePage]="store.auditPage()"
            [pageSize]="store.auditSize()"
            [tableLabel]="i18n.t('admin.audit.title')"
            (rowSelected)="selected.set($event['raw'])"
            (pageSizeChange)="store.auditSize.set($event)"
            (pageChange)="store.cargarAuditoria($event)"
          >
            <ng-template finCell="action" let-row>
              <b class="text-sm">{{ row.action }}</b>
              <small class="block text-xs text-muted-foreground">{{ row.raw.action }}</small>
            </ng-template>
            <ng-template finCell="entity" let-row>
              {{ row.entity }}
              <small class="block text-xs text-muted-foreground">{{ entityDetail(row.raw) }}</small>
            </ng-template>
            <ng-template finCell="trace" let-row>
              <button
                hlmBtn
                variant="outline"
                size="xs"
                type="button"
                class="font-mono"
                [attr.title]="i18n.t('admin.audit.trace.filterBy')"
                [attr.aria-label]="i18n.t('admin.audit.trace.filterBy') + ': ' + row.raw.traceId"
                (click)="$event.stopPropagation(); filterByTrace(row.raw.traceId)"
              >
                <fin-icon name="filter" /> {{ row.raw.traceId.slice(0, 12) }}
              </button>
            </ng-template>
          </fin-table>
        </app-admin-grid>
      </section>
    }
    <fin-sheet-panel
      [wide]="true"
      [open]="!!selected()"
      [title]="selected() ? labels.auditAction(selected()!.action) : ''"
      [subtitle]="labels.dateTimeLong(selected()?.createdAt)"
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
            <dt class="text-xs text-muted-foreground">{{ i18n.t('admin.audit.column.action') }}</dt>
            <dd>
              {{ labels.auditAction(event.action) }}
              <small class="block text-xs text-muted-foreground">{{ event.action }}</small>
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ i18n.t('admin.audit.column.entity') }}</dt>
            <dd>{{ labels.auditEntity(event.entityType) }} / {{ entityDetail(event) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ i18n.t('admin.common.traceId') }}</dt>
            <dd class="flex flex-wrap items-center gap-2">
              <code>{{ event.traceId }}</code>
              <button
                hlmBtn
                variant="outline"
                size="xs"
                type="button"
                (click)="filterByTrace(event.traceId); selected.set(null)"
              >
                <fin-icon name="filter" /> {{ i18n.t('admin.audit.trace.filterBy') }}
              </button>
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
  readonly labels = inject(AdminLabels);
  readonly i18n = inject(I18nService);

  readonly action = signal(this.store.auditFilter().action ?? '');
  readonly entityType = signal(this.store.auditFilter().entityType ?? '');
  readonly actor = signal(this.store.auditFilter().actorUserId ?? '');
  readonly affected = signal(this.store.auditFilter().userId ?? '');
  readonly traceId = signal(this.store.auditFilter().traceId ?? '');
  readonly from = signal('');
  readonly to = signal('');
  readonly selected = signal<ApiAuditEvent | null>(null);

  readonly columns = computed<TableColumn[]>(() => [
    { key: 'date', label: this.i18n.t('admin.audit.column.date') },
    { key: 'actor', label: this.i18n.t('admin.audit.column.actor') },
    { key: 'affected', label: this.i18n.t('admin.audit.column.affected') },
    { key: 'action', label: this.i18n.t('admin.audit.column.action') },
    { key: 'entity', label: this.i18n.t('admin.audit.column.entity') },
    { key: 'trace', label: this.i18n.t('admin.common.traceId'), sortable: false },
  ]);

  readonly rows = computed(() =>
    this.store.audit().map((event) => ({
      id: event.id,
      date: this.labels.dateTime(event.createdAt),
      actor: this.actorName(event),
      affected: event.userId ? this.store.userName(event.userId) : '—',
      action: this.labels.auditAction(event.action),
      entity: this.labels.auditEntity(event.entityType),
      trace: event.traceId,
      raw: event,
    })),
  );

  readonly actionOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('admin.audit.action.all') },
    ...AUDIT_ACTIONS.map((value) => ({ value, label: this.labels.auditAction(value), description: value })),
  ]);
  readonly entityOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('admin.audit.entity.all') },
    ...AUDIT_ENTITIES.map((value) => ({ value, label: this.labels.auditEntity(value) })),
  ]);
  readonly actorOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('admin.audit.actor.all') },
    ...this.store.users().map((user) => ({ value: user.id, label: user.displayName, description: user.email })),
  ]);
  readonly affectedOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('admin.audit.affected.all') },
    ...this.store.users().map((user) => ({ value: user.id, label: user.displayName, description: user.email })),
  ]);
  readonly hasFilters = computed(
    () => !!(this.action() || this.entityType() || this.actor() || this.affected() || this.from() || this.to()),
  );

  update(field: 'action' | 'entityType' | 'actor' | 'affected' | 'from' | 'to', value: string): void {
    this[field].set(value);
    void this.store.cargarAuditoria(1, this.filter());
  }

  clear(): void {
    this.action.set('');
    this.entityType.set('');
    this.actor.set('');
    this.affected.set('');
    this.traceId.set('');
    this.from.set('');
    this.to.set('');
    void this.store.cargarAuditoria(1, {});
  }

  filterByTrace(trace: string): void {
    this.traceId.set(trace);
    void this.store.cargarAuditoria(1, this.filter());
  }

  actorName(event: ApiAuditEvent): string {
    return event.actorUserId ? this.store.userName(event.actorUserId) : this.i18n.t('admin.audit.systemActor');
  }

  entityDetail(event: ApiAuditEvent): string {
    const id = event.entityId;
    if (!id) return '—';
    const type = event.entityType.toLowerCase();
    if (type === 'user') return this.store.userName(id);
    if (type === 'organization') return this.store.organizations().find((org) => org.id === id)?.name ?? id;
    return id;
  }

  changes(event: ApiAuditEvent): string {
    return prettyJson(event.changesJson);
  }

  private filter(): ApiAuditFilter {
    return {
      action: this.action() || undefined,
      entityType: this.entityType() || undefined,
      actorUserId: this.actor() || undefined,
      userId: this.affected() || undefined,
      traceId: this.traceId() || undefined,
      from: startOfDayIso(this.from()),
      to: endOfDayIso(this.to()),
    };
  }
}
