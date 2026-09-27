import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { HlmSwitch } from '@spartan-ng/helm/switch';
import { I18nService } from '@core/i18n';
import { IconComponent } from '@ui/icon';
import { UiOption, UiSelectComponent } from '@ui/select';
import { KpiRanges } from '@shared/tablero/kpi-ranges';

@Component({
  selector: 'fin-kpi-ranges-editor',
  imports: [FormsModule, HlmButton, HlmInput, HlmPopoverImports, HlmSwitch, IconComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <hlm-popover [state]="abierto() ? 'open' : 'closed'" (stateChanged)="alCambiarEstado($event)">
      <button
        hlmBtn
        hlmPopoverTrigger
        variant="ghost"
        size="icon-xs"
        type="button"
        [attr.aria-label]="i18n.t('dashboard.kpi.ranges.edit', { label: label() })"
      >
        <fin-icon name="palette" />
      </button>
      <div *hlmPopoverPortal="let ctx" hlmPopoverContent class="grid w-72 gap-3 p-3">
        <p class="text-sm font-semibold">{{ i18n.t('dashboard.kpi.ranges.title', { label: label() }) }}</p>
        <label class="flex items-center justify-between gap-2 text-sm"
          >{{ i18n.t('dashboard.kpi.ranges.enabled') }}
          <hlm-switch [checked]="activo()" (checkedChange)="activo.set($event)" />
        </label>
        @if (activo()) {
          <label class="grid gap-1 text-xs text-muted-foreground"
            >{{ i18n.t('dashboard.kpi.ranges.direction') }}
            <fin-select
              [options]="direcciones()"
              [ngModel]="altoEsPeor() ? 'worse' : 'better'"
              (ngModelChange)="altoEsPeor.set($event === 'worse')"
              [ariaLabel]="i18n.t('dashboard.kpi.ranges.direction')"
            />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <label class="grid gap-1 text-xs text-muted-foreground">
              <span class="flex items-center gap-1.5"
                ><span class="size-2.5 rounded-full bg-warning"></span>{{ i18n.t('dashboard.kpi.ranges.warnAt') }}</span
              >
              <input
                hlmInput
                type="number"
                inputmode="decimal"
                [ngModel]="amarillo()"
                (ngModelChange)="amarillo.set(+$event)"
              />
            </label>
            <label class="grid gap-1 text-xs text-muted-foreground">
              <span class="flex items-center gap-1.5"
                ><span class="size-2.5 rounded-full bg-destructive"></span
                >{{ i18n.t('dashboard.kpi.ranges.badAt') }}</span
              >
              <input
                hlmInput
                type="number"
                inputmode="decimal"
                [ngModel]="rojo()"
                (ngModelChange)="rojo.set(+$event)"
              />
            </label>
          </div>
          <p class="text-xs text-muted-foreground">{{ resumen() }}</p>
        }
        <div class="flex justify-between gap-2">
          <button hlmBtn variant="ghost" size="sm" type="button" (click)="restaurar()">
            {{ i18n.t('dashboard.kpi.ranges.reset') }}
          </button>
          <button hlmBtn size="sm" type="button" (click)="guardar()">{{ i18n.t('dashboard.kpi.ranges.save') }}</button>
        </div>
      </div>
    </hlm-popover>
  `,
})
export class KpiRangesEditorComponent {
  readonly i18n = inject(I18nService);
  readonly label = input('');
  readonly ranges = input<KpiRanges | null>(null);
  readonly change = output<KpiRanges | null | undefined>();
  readonly abierto = signal(false);
  readonly activo = signal(false);
  readonly altoEsPeor = signal(true);
  readonly amarillo = signal(50);
  readonly rojo = signal(80);

  direcciones(): readonly UiOption[] {
    return [
      { value: 'worse', label: this.i18n.t('dashboard.kpi.ranges.higherWorse') },
      { value: 'better', label: this.i18n.t('dashboard.kpi.ranges.higherBetter') },
    ];
  }

  resumen(): string {
    const clave = this.altoEsPeor() ? 'dashboard.kpi.ranges.summaryWorse' : 'dashboard.kpi.ranges.summaryBetter';
    return this.i18n.t(clave, { warn: this.amarillo(), bad: this.rojo() });
  }

  alCambiarEstado(estado: 'open' | 'closed'): void {
    if (estado === 'open') {
      const actual = this.ranges();
      this.activo.set(!!actual);
      if (actual) {
        this.altoEsPeor.set(actual.higherIsWorse);
        this.amarillo.set(actual.warnAt);
        this.rojo.set(actual.badAt);
      }
    }
    this.abierto.set(estado === 'open');
  }

  guardar(): void {
    this.change.emit(
      this.activo() ? { warnAt: this.amarillo(), badAt: this.rojo(), higherIsWorse: this.altoEsPeor() } : null,
    );
    this.abierto.set(false);
  }

  restaurar(): void {
    this.change.emit(undefined);
    this.abierto.set(false);
  }
}
