import { Component, Injectable, computed, effect, inject, input, signal } from '@angular/core';
import { I18nService } from '@core/i18n';
import { Pantalla } from '@ui/pantalla';

@Injectable()
export class KpiGridContext {
  readonly compact = signal(false);
}

@Component({
  selector: 'fin-kpi-grid',
  providers: [KpiGridContext],
  host: {
    role: 'group',
    class:
      'flex flex-wrap gap-3 *:min-w-0 *:flex-[1_1_220px] compacto:-mx-3.5 compacto:flex-nowrap compacto:snap-x compacto:snap-mandatory compacto:overflow-x-auto compacto:overscroll-x-contain compacto:px-3.5 compacto:pb-1 compacto:*:flex-[0_0_78%] compacto:*:snap-start',
    '[attr.aria-label]': 'i18n.t("kpi.grid.label")',
    '[attr.tabindex]': 'desplazable() ? 0 : null',
  },
  template: `<ng-content />`,
})
export class KpiGridComponent {
  readonly compact = input(true);
  protected readonly i18n = inject(I18nService);
  private readonly pantalla = inject(Pantalla);
  protected readonly desplazable = computed(() => this.pantalla.tamano() === 'compacto');
  private readonly context = inject(KpiGridContext);

  constructor() {
    effect(() => this.context.compact.set(this.compact()));
  }
}
