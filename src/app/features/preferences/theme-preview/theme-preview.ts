import { Component, computed, inject, input } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmBadge } from '@spartan-ng/helm/badge';
import { I18nService } from '@core/i18n';
import { StoredPalette, variablesDePaleta } from '@core/state';
import { IconComponent } from '@ui/icon';

const BARRAS = [42, 68, 55, 80, 47, 90, 62];

@Component({
  selector: 'fin-theme-preview',
  imports: [HlmButton, HlmBadge, IconComponent],
  host: { class: 'block' },
  template: `
    <div
      class="grid min-h-[340px] grid-cols-[132px_minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-background font-sans text-foreground shadow-sm max-[520px]:grid-cols-1"
      [style]="estilo()"
      role="img"
      [attr.aria-label]="i18n.t('preferences.preview.ariaLabel')"
    >
      <aside class="flex flex-col gap-1 border-r border-border bg-sidebar p-3 text-xs max-[520px]:hidden">
        <b class="mb-2 flex items-center gap-1.5 font-display text-xs"><fin-icon name="dashboard" /> Finanzas</b>
        <span class="rounded-md bg-sidebar-accent px-2 py-1.5 font-semibold text-sidebar-accent-foreground">
          {{ i18n.t('preferences.preview.dashboard') }}
        </span>
        <span class="px-2 py-1.5 text-muted-foreground">{{ i18n.t('preferences.preview.movements') }}</span>
        <span class="px-2 py-1.5 text-muted-foreground">{{ i18n.t('preferences.preview.accounts') }}</span>
      </aside>
      <div class="flex min-w-0 flex-col gap-3 p-3.5">
        <header class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <small class="text-xs text-muted-foreground">{{ i18n.t('preferences.preview.label') }}</small>
            <h3 class="truncate font-display text-sm font-semibold">{{ nombre() }}</h3>
          </div>
          <button hlmBtn size="sm" type="button" tabindex="-1">
            <fin-icon name="plus" /> {{ i18n.t('preferences.preview.actionButton') }}
          </button>
        </header>
        <div class="grid grid-cols-3 gap-2 max-[520px]:grid-cols-1">
          <div class="rounded-lg border border-border bg-card p-2.5">
            <small class="text-xs text-muted-foreground">{{ i18n.t('preferences.preview.balance') }}</small>
            <b class="block text-sm">$12,4 M</b>
            <span hlmBadge class="mt-1 text-xs">+8,4 %</span>
          </div>
          <div class="rounded-lg border border-border bg-card p-2.5">
            <small class="text-xs text-muted-foreground">{{ i18n.t('preferences.preview.expenses') }}</small>
            <b class="block text-sm text-destructive">$3,1 M</b>
            <span hlmBadge variant="secondary" class="mt-1 text-xs">-2,1 %</span>
          </div>
          <div class="rounded-lg border border-border bg-muted p-2.5">
            <small class="text-xs text-muted-foreground">{{ i18n.t('preferences.preview.savings') }}</small>
            <b class="block text-sm text-success">32 %</b>
          </div>
        </div>
        <div class="flex h-[92px] items-end gap-1.5 rounded-lg border border-border bg-card p-2.5">
          @for (alto of barras; track $index) {
            <i
              class="flex-1 rounded-t-sm"
              [class]="$index % 2 ? 'bg-primary' : 'bg-accent'"
              [style.height.%]="alto"
            ></i>
          }
        </div>
        <ul class="grid divide-y divide-border rounded-lg border border-border bg-card text-xs">
          <li class="flex justify-between px-2.5 py-1.5">
            <span>{{ i18n.t('preferences.preview.rowIncome') }}</span
            ><b class="text-success">+$4,2 M</b>
          </li>
          <li class="flex justify-between px-2.5 py-1.5">
            <span>{{ i18n.t('preferences.preview.rowExpense') }}</span
            ><b>-$180.000</b>
          </li>
        </ul>
        <div class="flex flex-wrap gap-2">
          <span class="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
            {{ i18n.t('preferences.preview.search') }}
          </span>
          <button hlmBtn variant="outline" size="sm" type="button" tabindex="-1">
            {{ i18n.t('preferences.preview.secondaryButton') }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ThemePreviewComponent {
  readonly i18n = inject(I18nService);
  readonly palette = input.required<StoredPalette>();
  readonly nombre = computed(() => this.palette().name ?? '');
  readonly barras = BARRAS;
  readonly estilo = computed(() => variablesDePaleta({ ...this.palette(), custom: true }));
}
