import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { ApiClientError } from '../../../../core/api/administration.api';
import { FinanceApiClient } from '../../../../core/api-client';
import { I18nService } from '../../../../core/i18n';
import { P } from '../../../../core/permissions';
import { CAPABILITIES, AppStore } from '../../../../core/store';
import { EmptyStateComponent } from '../../../../ui/empty-state/empty-state';
import { IconComponent } from '../../../../ui/icon';
import { PagerComponent } from '../../../../ui/pager/pager';
import { SheetPanelComponent } from '../../../../ui/sheet-panel/sheet-panel';
import { UiOption, UiSelectComponent } from '../../../../ui/select';
import { AdminLabels } from '../../admin-labels';
import { AdminStore } from '../../admin.store';

@Component({
  selector: 'app-admin-errors-tab',
  imports: [
    DatePipe,
    FormsModule,
    HlmBadge,
    HlmButton,
    EmptyStateComponent,
    IconComponent,
    PagerComponent,
    SheetPanelComponent,
    UiSelectComponent,
  ],
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
        <ul class="divide-y divide-border">
          @for (error of store.errors(); track error.id) {
            <li>
              <button
                type="button"
                class="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-accent/60"
                (click)="selected.set(error)"
              >
                <span hlmBadge variant="outline">{{ error.source }}</span>
                <span class="flex min-w-0 flex-1 flex-col">
                  <b class="truncate text-sm">{{ error.message }}</b>
                  <small class="truncate text-xs text-muted-foreground">
                    {{ error.version }} · {{ error.lastSeenAt | date: 'dd MMM, HH:mm' }} ·
                    {{ i18n.t('admin.errors.affectedUsersLabel', { count: error.affectedUsers }) }}
                  </small>
                </span>
                <strong class="text-sm">{{ error.occurrences }}×</strong>
                <span hlmBadge [variant]="error.status === 'resolved' ? 'secondary' : 'destructive'">
                  {{ labels.errorState(error.status) }}
                </span>
                <fin-icon name="next" />
              </button>
            </li>
          } @empty {
            <li class="px-4 py-8 text-center text-sm text-muted-foreground">{{ i18n.t('table.empty') }}</li>
          }
        </ul>
        <fin-pager
          class="p-4"
          [page]="store.errorsPage()"
          [size]="store.errorsSize"
          [total]="store.errorsTotal()"
          (pageChange)="store.cargarErrores($event)"
        />
      </section>
    }
    <fin-sheet-panel
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
          <img
            class="max-w-full rounded-lg border border-border"
            [src]="api.screenshotUrl(error.id)"
            [alt]="i18n.t('admin.errors.drawer.screenshotAlt')"
          />
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
            <dd>{{ error.lastSeenAt | date: 'medium' }}</dd>
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

  async setStatus(error: ApiClientError, status: ApiClientError['status']): Promise<void> {
    if (status === error.status) return;
    try {
      await this.store.actualizarError(error, status);
    } catch {
      this.app.toast.set(this.i18n.t('admin.toast.errorStatusFailed'));
    }
  }
}
