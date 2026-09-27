import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCard } from '@spartan-ng/helm/card';
import { I18nService } from '@core/i18n';
import { AppStore } from '@core/state';
import { DashboardLayoutService, VistaDeReporte } from '@shared/tablero/dashboard-layout.service';
import {
  crearEntorno,
  granularidadParaRango,
  EditorDeVistaComponent,
  VistaEditable,
  OpcionesDeGraficas,
  construirVisual,
} from '@shared/graficas';
import { crearMovimientosDelPeriodo } from '@shared/historia';
import { ChartComponent, ChartThemeService } from '@ui/chart';
import { DateFieldComponent } from '@ui/date-field';
import { FieldComponent } from '@ui/field';
import { IconComponent } from '@ui/icon';
import { UiOption, UiSelectComponent } from '@ui/select';
import { PRESETS_DE_PERIODO, PresetDePeriodo, rangoDePreset } from './periodos';
import { type PlantillaDeVista, VistasGuardadasComponent } from '@shared/vistas-guardadas';

const VISTAS_INICIALES: readonly VistaDeReporte[] = [
  {
    id: 'inicial-flujo',
    title: '',
    config: { tipo: 'grouped', dimension: 'date', dimension2: 'flow', measure: 'amount' },
    wide: true,
  },
  {
    id: 'inicial-sankey',
    title: '',
    config: { tipo: 'sankey', dimension: 'account', dimension2: 'category', measure: 'expense' },
    wide: false,
  },
  {
    id: 'inicial-sol',
    title: '',
    config: { tipo: 'sunburst', dimension: 'category', dimension2: 'account', measure: 'expense' },
    wide: false,
  },
  { id: 'inicial-calendario', title: '', config: { tipo: 'calendar', measure: 'expense' }, wide: true },
  { id: 'inicial-cajas', title: '', config: { tipo: 'boxplot', dimension: 'category' }, wide: false },
  {
    id: 'inicial-matriz',
    title: '',
    config: { tipo: 'matrix', dimension: 'weekday', dimension2: 'category', measure: 'expense' },
    wide: false,
  },
];

const PLANTILLAS: readonly { id: string; preset: PresetDePeriodo }[] = [
  { id: 'monthly', preset: 'month' },
  { id: 'quarterly', preset: 'quarter' },
  { id: 'semiannual', preset: 'last6' },
  { id: 'yearly', preset: 'year' },
  { id: 'last12', preset: 'last12' },
];

interface ReporteGuardado {
  readonly version: number;
  readonly preset: PresetDePeriodo;
  readonly desde?: string;
  readonly hasta?: string;
  readonly cuenta?: string;
  readonly categoria?: string;
  readonly flujo?: 'all' | 'in' | 'out';
  readonly vistas?: readonly VistaDeReporte[];
}

@Component({
  selector: 'fin-explorador-de-reportes',
  imports: [
    FormsModule,
    HlmButton,
    HlmCard,
    ChartComponent,
    DateFieldComponent,
    EditorDeVistaComponent,
    FieldComponent,
    IconComponent,
    UiSelectComponent,
    VistasGuardadasComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './explorador.html',
  host: { class: 'flex flex-col gap-3.5' },
})
export class ExploradorDeReportesComponent {
  readonly i18n = inject(I18nService);
  readonly store = inject(AppStore);
  private readonly tema = inject(ChartThemeService);
  private readonly layout = inject(DashboardLayoutService);
  private readonly opciones = inject(OpcionesDeGraficas);

  readonly preset = signal<PresetDePeriodo>('last6');
  readonly ancla = signal(this.store.hoy());
  readonly desde = signal(this.store.hoy().slice(0, 8) + '01');
  readonly hasta = signal(this.store.hoy());
  readonly cuenta = signal('all');
  readonly categoria = signal('all');
  readonly flujo = signal<'all' | 'in' | 'out'>('all');
  readonly editando = signal<VistaEditable | null | undefined>(undefined);

  readonly rango = computed(() =>
    this.preset() === 'custom'
      ? {
          start: this.desde() <= this.hasta() ? this.desde() : this.hasta(),
          end: this.desde() <= this.hasta() ? this.hasta() : this.desde(),
        }
      : rangoDePreset(this.preset(), this.ancla()),
  );
  private readonly delPeriodo = crearMovimientosDelPeriodo(this.rango);
  readonly cargando = this.delPeriodo.cargando;
  readonly completos = this.delPeriodo.completos;

  readonly movimientos = computed(() =>
    this.delPeriodo
      .movimientos()
      .filter(
        (m) =>
          (this.cuenta() === 'all' || m.accountId === this.cuenta()) &&
          (this.categoria() === 'all' || m.category === this.categoria()) &&
          (this.flujo() === 'all' || (this.flujo() === 'in' ? m.amount > 0 : m.amount < 0)),
      ),
  );
  readonly granularidad = computed(() => granularidadParaRango(this.rango().start, this.rango().end));

  readonly vistasDelReporte = signal<readonly VistaDeReporte[] | null>(null);
  private readonly listaBase = computed(() => this.vistasDelReporte() ?? this.layout.reportViews() ?? VISTAS_INICIALES);

  readonly plantillas = computed<readonly PlantillaDeVista[]>(() =>
    PLANTILLAS.map((plantilla) => ({
      id: plantilla.id,
      nombre: this.i18n.t(`reports.saved.template.${plantilla.id}`),
      json: JSON.stringify({
        version: 1,
        preset: plantilla.preset,
        cuenta: 'all',
        categoria: 'all',
        flujo: 'all',
        vistas: VISTAS_INICIALES,
      }),
    })),
  );

  readonly estado = computed(() =>
    JSON.stringify({
      version: 1,
      preset: this.preset(),
      desde: this.preset() === 'custom' ? this.desde() : undefined,
      hasta: this.preset() === 'custom' ? this.hasta() : undefined,
      cuenta: this.cuenta(),
      categoria: this.categoria(),
      flujo: this.flujo(),
      vistas: this.listaBase(),
    }),
  );

  cargarReporte(json: string | null): void {
    this.ancla.set(this.store.hoy());
    let guardado: ReporteGuardado | null = null;
    try {
      guardado = json ? (JSON.parse(json) as ReporteGuardado) : null;
    } catch {
      guardado = null;
    }
    if (!guardado || guardado.version !== 1) {
      this.vistasDelReporte.set(null);
      this.preset.set('last6');
      this.cuenta.set('all');
      this.categoria.set('all');
      this.flujo.set('all');
      return;
    }
    this.preset.set(PRESETS_DE_PERIODO.includes(guardado.preset) ? guardado.preset : 'last6');
    if (guardado.desde) this.desde.set(guardado.desde);
    if (guardado.hasta) this.hasta.set(guardado.hasta);
    this.cuenta.set(guardado.cuenta ?? 'all');
    this.categoria.set(guardado.categoria ?? 'all');
    this.flujo.set(guardado.flujo ?? 'all');
    this.vistasDelReporte.set(guardado.vistas?.length ? guardado.vistas : VISTAS_INICIALES);
  }

  private guardarLista(lista: readonly VistaDeReporte[]): void {
    if (this.vistasDelReporte() !== null) this.vistasDelReporte.set(lista);
    else this.layout.saveReportViews(lista);
  }

  readonly vistas = computed<readonly VistaDeReporte[]>(() =>
    this.listaBase().map((vista) => ({
      ...vista,
      title: vista.title || this.opciones.etiquetaDeTipo(vista.config.tipo),
    })),
  );

  readonly opcionesDeVistas = computed(() => {
    const palette = this.tema.palette();
    const movs = this.movimientos();
    return new Map(
      this.vistas().map((vista) => [
        vista.id,
        construirVisual({
          config: vista.config,
          movs,
          entorno: crearEntorno(
            this.store,
            this.i18n,
            palette,
            vista.config.granularity ?? this.granularidad(),
            vista.title,
          ),
        }),
      ]),
    );
  });

  readonly presets = computed<readonly UiOption[]>(() =>
    PRESETS_DE_PERIODO.map((p) => ({ value: p, label: this.i18n.t(`reports.explorer.preset.${p}`) })),
  );
  readonly cuentas = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('reports.explorer.allAccounts') },
    ...this.store.data().accounts.map((a) => ({ value: a.id, label: a.name })),
  ]);
  readonly categorias = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('reports.explorer.allCategories') },
    ...[
      ...new Set(
        this.delPeriodo
          .movimientos()
          .map((m) => m.category)
          .filter(Boolean),
      ),
    ]
      .sort()
      .map((c) => ({ value: c, label: c })),
  ]);
  readonly flujos = computed<readonly UiOption[]>(() => [
    { value: 'all', label: this.i18n.t('reports.explorer.flow.all') },
    { value: 'out', label: this.i18n.t('charts.flow.out') },
    { value: 'in', label: this.i18n.t('charts.flow.in') },
  ]);
  readonly etiquetaDelRango = computed(() => {
    const formato = new Intl.DateTimeFormat(this.store.preferences().locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const { start, end } = this.rango();
    return `${formato.format(new Date(`${start}T12:00:00Z`))} – ${formato.format(new Date(`${end}T12:00:00Z`))}`;
  });

  moverAncla(direccion: -1 | 1): void {
    const base = new Date(`${this.ancla()}T12:00:00Z`);
    const meses = { month: 1, quarter: 3, year: 12, last3: 3, last6: 6, last12: 12, custom: 0 }[this.preset()];
    base.setUTCMonth(base.getUTCMonth() + direccion * meses);
    this.ancla.set(base.toISOString().slice(0, 10));
  }

  guardarVista(vista: VistaEditable): void {
    const actuales = this.listaBase();
    const existe = actuales.some((v) => v.id === vista.id);
    this.guardarLista(existe ? actuales.map((v) => (v.id === vista.id ? vista : v)) : [...actuales, vista]);
    this.editando.set(undefined);
  }

  quitarVista(id: string): void {
    this.guardarLista(this.listaBase().filter((v) => v.id !== id));
  }

  duplicarVista(vista: VistaDeReporte): void {
    this.guardarLista([...this.listaBase(), { ...vista, id: `vista-${Date.now()}`, title: `${vista.title} (2)` }]);
  }

  moverVista(id: string, direccion: -1 | 1): void {
    const lista = [...this.listaBase()];
    const i = lista.findIndex((v) => v.id === id);
    const destino = i + direccion;
    if (i < 0 || destino < 0 || destino >= lista.length) return;
    [lista[i], lista[destino]] = [lista[destino], lista[i]];
    this.guardarLista(lista);
  }

  alternarAncho(vista: VistaDeReporte): void {
    this.guardarVista({ ...vista, wide: !vista.wide });
  }

  restaurar(): void {
    this.guardarLista(VISTAS_INICIALES);
  }
}
