import { ChangeDetectionStrategy, Component, Injectable, effect, inject, input, signal } from '@angular/core';

@Injectable()
export class KpiGridContext {
  readonly compact = signal(false);
}

@Component({
  selector: 'fin-kpi-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [KpiGridContext],
  host: {
    class: 'flex flex-wrap gap-3 *:min-w-0 *:flex-[1_1_220px] max-[520px]:*:basis-full',
  },
  template: `<ng-content />`,
})
export class KpiGridComponent {
  readonly compact = input(true);
  private readonly context = inject(KpiGridContext);

  constructor() {
    effect(() => this.context.compact.set(this.compact()));
  }
}
