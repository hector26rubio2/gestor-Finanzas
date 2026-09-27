import { ChangeDetectionStrategy, Component, inject, model } from '@angular/core';
import { I18nService } from '@core/i18n';
import { OpcionesDeGraficas } from '../opciones-de-graficas';

@Component({
  selector: 'fin-galeria-visual',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-3" role="radiogroup" [attr.aria-label]="i18n.t('charts.picker.label')">
      @for (grupo of opciones.grupos(); track grupo.grupo) {
        <section class="flex flex-col gap-1.5">
          <h3 class="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">{{ grupo.label }}</h3>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1.5">
            @for (item of grupo.tipos; track item.tipo) {
              <button
                type="button"
                role="radio"
                class="rounded-md border border-border bg-card px-2.5 py-2 text-left text-[0.8rem] font-medium transition-colors hover:border-primary aria-checked:border-primary aria-checked:bg-accent aria-checked:text-primary"
                [attr.aria-checked]="valor() === item.tipo"
                (click)="valor.set(item.tipo)"
              >
                {{ item.label }}
              </button>
            }
          </div>
        </section>
      }
    </div>
  `,
})
export class GaleriaVisualComponent {
  readonly i18n = inject(I18nService);
  readonly opciones = inject(OpcionesDeGraficas);
  readonly valor = model<string>('bar');
}
