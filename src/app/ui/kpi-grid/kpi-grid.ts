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
    class: 'grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3 max-[1100px]:grid-cols-2',
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
