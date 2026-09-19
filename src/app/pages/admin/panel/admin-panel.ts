import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-admin-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card' },
  template: `
    <header class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border px-5 py-4">
      <div class="min-w-0">
        <h2 class="text-base font-semibold">{{ title() }}</h2>
        @if (subtitle()) {
          <p class="text-sm text-muted-foreground">{{ subtitle() }}</p>
        }
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <ng-content select="[panelActions]" />
      </div>
    </header>
    <ng-content />
  `,
})
export class AdminPanelComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
