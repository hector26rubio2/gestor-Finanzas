import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { ApiClientError } from '../../../../core/api/administration.api';
import { FinanceApiClient } from '../../../../core/api/api-client';
import { I18nService } from '../../../../core/i18n';
import { P } from '../../../../core/session/permissions';
import { CAPABILITIES, AppStore } from '../../../../core/state/store';
import { EmptyStateComponent } from '../../../../ui/empty-state/empty-state';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { DataTableComponent, TableColumn } from '../../../../ui/data-table/data-table';
import { FinTableCellDirective } from '../../../../ui/data-table/table-cell.directive';
import { IconComponent } from '../../../../ui/icon/icon';
import { SheetPanelComponent } from '../../../../ui/sheet-panel/sheet-panel';
import { UiOption, UiSelectComponent } from '../../../../ui/select/select';
import { AdminLabels } from '../../admin-labels';
import { AdminStore } from '../../admin.store';
import { AdminGridComponent } from '../../panel/admin-grid';

@Component({
  selector: 'app-admin-errors-tab',
  imports: [
    FormsModule,
    HlmBadge,
    HlmButton,
    AdminGridComponent,
    DataTableComponent,
    FinTableCellDirective,
    HlmDialogImports,
    EmptyStateComponent,
    IconComponent,
    SheetPanelComponent,
    UiSelectComponent,
  ],
  host: { class: 'flex min-w-0 flex-col gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.sinDatos()) {
      <fin-empty [title]="i18n.t('admin.emptyState.title')" [detail]="i18n.t('admin.emptyState.errors.detail')" />
    } @else {
      <section class="rounded-xl border border-border bg-card">
        <header class="flex flex-wrap items-end justify-between gap-3 p-4">
          <div>
            <h2 class="text-base font-semibold">{{ i18n.t('admin.errors.title') }}</h2>
            <p class="text-sm text-muted-foreground">{{ i18n.t('admin.errors.subtitle') }}</p>
          </div>
          <fin-select
            class="w-52"
            [ngModel]="store.errorsStatus()"
            (ngModelChange)="store.cargarErrores(1, $event)"
            [options]="statusOptions()"
            [ariaLabel]="i18n.t('admin.errors.statusFilterAriaLabel')"
          />
        </header>
        <app-admin-grid>
          <fin-table
            [columns]="columns()"
            [rows]="rows()"
            [totalRows]="store.errorsTotal()"
            [remotePage]="store.errorsPage()"
            [pageSize]="store.errorsSize()"
            [tableLabel]="i18n.t('admin.errors.title')"
            (rowSelected)="selected.set($event['raw'])"
            (pageSizeChange)="store.errorsSize.set($event)"
            (pageChange)="store.cargarErrores($event)"
          >
            <ng-template finCell="source" let-row>
              <span hlmBadge variant="outline">{{ row.raw.source }}</span>
            </ng-template>
            <ng-template finCell="message" let-row>
              <span class="flex min-w-0 flex-col">
                <b class="truncate text-sm">{{ row.raw.title || row.raw.message }}</b>
                <small class="truncate text-xs text-muted-foreground">
                  {{ row.raw.version }} ·
                  {{ i18n.t('admin.errors.affectedUsersLabel', { count: row.raw.affectedUsers }) }}
                </small>
              </span>
            </ng-template>
            <ng-template finCell="status" let-row>
              <span hlmBadge [variant]="row.raw.status === 'resolved' ? 'secondary' : 'destructive'">{{
                row.status
              }}</span>
            </ng-template>
          </fin-table>
        </app-admin-grid>
      </section>
    }
    <fin-sheet-panel
      [wide]="true"
      [open]="!!selectedError()"
      [title]="i18n.t('admin.errors.drawer.title')"
      [subtitle]="selectedError()?.fingerprint ?? ''"
      (closed)="selected.set(null)"
    >
      @if (selectedError(); as error) {
        <div class="flex flex-col gap-1">
          <b>{{ error.title || error.message }}</b>
          <small class="text-muted-foreground">{{ error.source }} · {{ error.version }}</small>
        </div>
        @if (error.title) {
          <p class="text-sm">{{ error.message }}</p>
        }
        @if (error.stepsToReproduce) {
          <p class="text-sm">
            <b>{{ i18n.t('admin.errors.drawer.steps') }}:</b> {{ error.stepsToReproduce }}
          </p>
        }
        @if (error.hasScreenshot) {
          <button
            type="button"
            class="group relative w-fit overflow-hidden rounded-lg border border-border bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            [attr.aria-label]="i18n.t('admin.errors.drawer.screenshotExpand')"
            (click)="zoomed.set(true)"
          >
            <img
              class="h-32 w-auto max-w-[16rem] object-cover object-top"
              [src]="api.screenshotUrl(error.id)"
              [alt]="i18n.t('admin.errors.drawer.screenshotAlt')"
            />
            <span
              class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-background/80 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              <fin-icon name="search" class="[--icon-size:13px]" /> {{ i18n.t('admin.errors.drawer.screenshotExpand') }}
            </span>
          </button>
          <hlm-dialog [state]="zoomed() ? 'open' : 'closed'" (stateChanged)="onZoomState($event)">
            <hlm-dialog-content
              *hlmDialogPortal="let ctx"
              class="w-[min(96vw,1200px)] max-w-none gap-2 p-3 sm:max-w-none"
            >
              <h2 hlmDialogTitle class="sr-only">{{ i18n.t('admin.errors.drawer.screenshotAlt') }}</h2>
              <img
                class="max-h-[80dvh] w-full rounded-md object-contain"
                [src]="api.screenshotUrl(error.id)"
                [alt]="i18n.t('admin.errors.drawer.screenshotAlt')"
              />
            </hlm-dialog-content>
          </hlm-dialog>
        }
        <dl class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt class="text-xs text-muted-foreground">{{ i18n.t('admin.errors.drawer.occurrences') }}</dt>
            <dd>{{ error.occurrences }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ i18n.t('admin.errors.drawer.affectedUsers') }}</dt>
            <dd>{{ error.affectedUsers }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ i18n.t('admin.errors.drawer.lastSeen') }}</dt>
            <dd>{{ labels.dateTimeLong(error.lastSeenAt) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">{{ i18n.t('admin.common.traceId') }}</dt>
            <dd>
              <code>{{ error.traceId || i18n.t('admin.errors.drawer.traceIdMissing') }}</code>
            </dd>
          </div>
        </dl>
        @if (error.githubIssueUrl) {
          <a hlmBtn [href]="error.githubIssueUrl" target="_blank" rel="noopener">
            {{ i18n.t('admin.errors.drawer.githubLink') }} ↗
          </a>
        } @else if (error.title && caps.allows(P.administracion.errores.editar)) {
          <button hlmBtn variant="outline" type="button" [disabled]="creatingIssue()" (click)="createIssue(error)">
            <fin-icon name="flag" /> {{ i18n.t('admin.errors.createIssue') }}
          </button>
        }
        <label class="flex flex-col gap-1.5 text-sm font-medium">
          {{ i18n.t('admin.errors.drawer.statusLabel') }}
          <fin-select
            [ngModel]="error.status"
            [disabled]="!caps.allows(P.administracion.errores.editar)"
            [options]="stateOptions()"
            [ariaLabel]="i18n.t('admin.errors.drawer.statusAriaLabel')"
            (ngModelChange)="setStatus(error, $event)"
          />
        </label>
        <p class="text-xs text-muted-foreground">{{ i18n.t('admin.errors.drawer.privacyNote') }}</p>
      }
    </fin-sheet-panel>
  `,
})
export class ErrorsTabComponent {
  readonly store = inject(AdminStore);
  readonly api = inject(FinanceApiClient);
  readonly i18n = inject(I18nService);
  readonly labels = inject(AdminLabels);
  readonly caps = inject(CAPABILITIES);
  private readonly app = inject(AppStore);
  readonly P = P;

  readonly selected = signal<ApiClientError | null>(null);
  readonly zoomed = signal(false);

  readonly columns = computed<TableColumn[]>(() => [
    { key: 'source', label: this.i18n.t('admin.errors.column.source') },
    { key: 'message', label: this.i18n.t('admin.errors.column.message') },
    { key: 'occurrences', label: this.i18n.t('admin.errors.column.occurrences') },
    { key: 'status', label: this.i18n.t('admin.errors.column.status') },
    { key: 'lastSeen', label: this.i18n.t('admin.errors.drawer.lastSeen') },
  ]);

  readonly rows = computed(() =>
    this.store.errors().map((error) => ({
      id: error.id,
      source: error.source,
      message: `${error.title ?? ''} ${error.message}`,
      occurrences: `${error.occurrences}×`,
      status: this.labels.errorState(error.status),
      lastSeen: this.labels.dateTime(error.lastSeenAt),
      raw: error,
    })),
  );
  readonly creatingIssue = signal(false);
  readonly selectedError = computed(
    () => this.store.errors().find((error) => error.id === this.selected()?.id) ?? this.selected(),
  );

  readonly stateOptions = computed<readonly UiOption[]>(() => [
    { value: 'new', label: this.i18n.t('admin.errors.status.new') },
    { value: 'investigating', label: this.i18n.t('admin.errors.status.investigating') },
    { value: 'resolved', label: this.i18n.t('admin.errors.status.resolved') },
  ]);
  readonly statusOptions = computed<readonly UiOption[]>(() => [
    { value: '', label: this.i18n.t('admin.errors.status.all') },
    ...this.stateOptions(),
  ]);

  onZoomState(state: 'open' | 'closed'): void {
    if (state === 'closed') this.zoomed.set(false);
  }

  async createIssue(error: ApiClientError): Promise<void> {
    this.creatingIssue.set(true);
    try {
      const result = await this.store.crearIssueDeGithub(error);
      this.app.toast.set(
        result.githubStatus === 'created'
          ? this.i18n.t('admin.errors.issueCreated')
          : `${this.i18n.t('admin.errors.issueFailed')}: ${result.githubDetail ?? result.githubStatus}`,
      );
    } catch {
      this.app.toast.set(this.i18n.t('admin.errors.issueFailed'));
    } finally {
      this.creatingIssue.set(false);
    }
  }

  async setStatus(error: ApiClientError, status: ApiClientError['status']): Promise<void> {
    if (status === error.status) return;
    try {
      await this.store.actualizarError(error, status);
    } catch {
      this.app.toast.set(this.i18n.t('admin.toast.errorStatusFailed'));
    }
  }
}
