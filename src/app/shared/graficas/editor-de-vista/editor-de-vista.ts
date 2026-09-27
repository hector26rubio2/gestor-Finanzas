import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { I18nService } from '@core/i18n';
import type { Movement } from '@core/state';
import { AppStore } from '@core/state';
import { ChartComponent, ChartThemeService } from '@ui/chart';
import { FieldComponent } from '@ui/field';
import { IconComponent } from '@ui/icon';
import { OverlayComponent } from '@ui/overlay';
import { UiSelectComponent } from '@ui/select';
import { definicionDe } from '../catalogo';
import { ConfiguradorVisualComponent } from '../configurador/configurador';
import { crearEntorno } from '../contexto';
import { GaleriaVisualComponent } from '../galeria-visual/galeria-visual';
import type { ConfiguracionVisual, Granularidad } from '../modelo';
import { construirVisual } from '../visual';

export interface VistaEditable {
  readonly id: string;
  readonly title: string;
  readonly config: ConfiguracionVisual;
  readonly wide: boolean;
}

@Component({
  selector: 'fin-editor-de-vista',
  imports: [
    FormsModule,
    HlmButton,
    HlmInput,
    ChartComponent,
    FieldComponent,
    IconComponent,
    OverlayComponent,
    UiSelectComponent,
    ConfiguradorVisualComponent,
    GaleriaVisualComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fin-overlay [title]="titulo()" mode="modal" [wide]="true" (closed)="cerrar.emit()">
      <form class="grid gap-4" (submit)="enviar($event)">
        <div class="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
          <fin-field [label]="i18n.t('dashboard.widgetForm.name')">
            <input
              hlmInput
              name="titulo"
              [ngModel]="nombre()"
              (ngModelChange)="nombre.set($event)"
              required
              maxlength="60"
            />
          </fin-field>
          <fin-field [label]="i18n.t('dashboard.widgetForm.distribution')">
            <fin-select
              name="ancho"
              [ngModel]="ancha() ? 'wide' : 'half'"
              (ngModelChange)="ancha.set($event === 'wide')"
              [options]="anchos()"
              [ariaLabel]="i18n.t('dashboard.widgetForm.distribution.ariaLabel')"
            />
          </fin-field>
        </div>
        <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-5 max-[900px]:grid-cols-1">
          <div class="max-h-[60vh] min-w-0 overflow-y-auto pe-1">
            <fin-galeria-visual [valor]="config().tipo" (valorChange)="elegir($event)" />
          </div>
          <div class="flex min-w-0 flex-col gap-3">
            <fin-configurador-visual [conTipo]="false" [(config)]="config" />
            <div class="rounded-lg border border-border bg-card p-3">
              <fin-chart [option]="vistaPrevia()" [height]="300" [ariaLabel]="nombre()" />
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button hlmBtn variant="outline" type="button" (click)="cerrar.emit()">
            <fin-icon name="close" /> {{ i18n.t('dashboard.widgetForm.cancel') }}
          </button>
          <button hlmBtn type="submit" [disabled]="!nombre().trim()">
            <fin-icon name="check" /> {{ i18n.t('form.actions.save') }}
          </button>
        </div>
      </form>
    </fin-overlay>
  `,
})
export class EditorDeVistaComponent implements OnInit {
  readonly i18n = inject(I18nService);
  private readonly store = inject(AppStore);
  private readonly tema = inject(ChartThemeService);
  readonly vista = input<VistaEditable | null>(null);
  readonly movimientos = input.required<readonly Movement[]>();
  readonly granularidad = input<Granularidad>('month');
  readonly guardar = output<VistaEditable>();
  readonly cerrar = output<void>();

  readonly nombre = signal('');
  readonly ancha = signal(true);
  readonly config = signal<ConfiguracionVisual>({
    tipo: 'stackedBars',
    dimension: 'date',
    dimension2: 'category',
    measure: 'expense',
  });
  readonly titulo = computed(() =>
    this.i18n.t(this.vista() ? 'reports.explorer.editView' : 'reports.explorer.addView'),
  );
  readonly anchos = computed(() => [
    { value: 'wide', label: this.i18n.t('dashboard.widgetWidth.wide') },
    { value: 'half', label: this.i18n.t('dashboard.widgetWidth.half') },
  ]);

  readonly vistaPrevia = computed(() =>
    construirVisual({
      config: this.config(),
      movs: this.movimientos(),
      entorno: crearEntorno(
        this.store,
        this.i18n,
        this.tema.palette(),
        this.config().granularity ?? this.granularidad(),
        this.nombre(),
      ),
    }),
  );

  ngOnInit(): void {
    const actual = this.vista();
    if (!actual) return;
    this.nombre.set(actual.title);
    this.ancha.set(actual.wide);
    this.config.set(actual.config);
  }

  elegir(tipo: string): void {
    const definicion = definicionDe(tipo);
    if (!definicion) return;
    this.ancha.set(definicion.ancha);
    if (!this.nombre().trim()) this.nombre.set(this.i18n.t(`charts.type.${tipo}`));
    this.config.update((actual) => ({
      ...actual,
      tipo: definicion.tipo,
      variant: undefined,
      dimension: definicion.sugerida.dimension,
      dimension2: definicion.sugerida.dimension2,
      measure: definicion.sugerida.measure ?? actual.measure ?? 'expense',
    }));
  }

  enviar(evento: Event): void {
    evento.preventDefault();
    const nombre = this.nombre().trim();
    if (!nombre) return;
    this.guardar.emit({
      id: this.vista()?.id ?? `vista-${Date.now()}`,
      title: nombre,
      config: this.config(),
      wide: this.ancha(),
    });
  }
}
