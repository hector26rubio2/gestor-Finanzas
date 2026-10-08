import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'fin-widget-card',
  templateUrl: './widget-card.html',
  host: {
    '[class]': 'hostClass()',
    '[class.col-span-full]': 'wide()',
  },
})
export class WidgetCardComponent {
  readonly kicker = input.required<string>();
  readonly title = input.required<string>();
  readonly wide = input(false);
  readonly fill = input(false);
  readonly hostClass = computed(() =>
    this.fill()
      ? 'flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card px-5 py-4'
      : 'flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card px-6 py-[22px] max-[700px]:col-auto',
  );
}
