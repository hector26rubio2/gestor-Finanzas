import { Injectable, computed, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FinanceApiClient, ApiWritesBus, claveDeConcepto } from '@core/api';
import type { ApiObligation, ApiRecurrence } from '@core/api';
import type { EscenarioGuardado, MedidaDeComparacion, VistaDeGrafica } from '@shared/proyecciones';
import { P } from '@core/session';
import { CAPABILITIES, AppStore } from '@core/state';
import { crearMovimientosDelPeriodo } from '@shared/historia';
import { I18nService } from '@core/i18n';
import { addDaysToIso, addMonthsToIso, sumBy } from '@core/utils';
import { traerMovimientosDeTarjetas } from '@shared/tarjetas';
import type { Movement } from '@core/state';
import { type Deuda, type Palanca, type Proyeccion, cuotaFija, proyectar, type DeudaActual, type OrdenDeAbono, CUOTAS_SUPUESTAS, TASA_MENSUAL_SUPUESTA_TARJETA, cuotaParaTerminarEn, deudasActuales, type AjusteDeLinea, type CambioDeFlujo, flujoPorMes, flujoPromedio, lineasPorCategoria, recurrentesDeFlujo, horizonteDeDeudas, mesesHasta, planDeAbonos, proyectarInversion, tasaPromedioDeInversiones } from '@shared/proyecciones';

export type AjusteDeDeuda = Partial<Pick<Deuda, 'saldo' | 'tasaMensual' | 'cuotas'>>;

export type EventoDelEscenario =
  | {
      readonly tipo: 'abono';
      readonly id: string;
      readonly deudaId: string;
      readonly mes: number;
      readonly monto: number;
    }
  | {
      readonly tipo: 'tasa';
      readonly id: string;
      readonly deudaId: string;
      readonly mes: number;
      readonly tasaMensual: number;
    };

interface EstadoGuardado {
  readonly version: number;
  readonly recorte?: number;
  readonly ajustesDeLinea?: Record<string, AjusteDeLinea>;
  readonly recurrentesQuitados?: string[];
  readonly cambiosDeFlujo?: CambioDeFlujo[];
  readonly vista?: VistaDeGrafica;
  readonly medidaDeComparacion?: MedidaDeComparacion;
  readonly escenariosGuardados?: EscenarioGuardado[];
  readonly ajustes?: Record<string, AjusteDeDeuda>;
  readonly excluidas?: string[];
  readonly hipoteticas?: Deuda[];
  readonly abonoMensual?: number;
  readonly orden?: OrdenDeAbono;
  readonly eventos?: EventoDelEscenario[];
  readonly fechaSinDeudas?: string;
  readonly compra?: { monto: number; nombre: string; cuotas: number; tasa: number; mes: number };
  readonly meta?: { monto: number; fecha: string };
  readonly inversion?: { inicial: number; aporte: number; tasa: number; fecha: string };
}

export const ID_DE_LA_COMPRA = 'compra:simulada';
const RENDIMIENTO_SUPUESTO = 8;
const MESES_MINIMOS = 12;

let secuencia = 0;
const nuevoId = (prefijo: string) => `${prefijo}:${Date.now().toString(36)}${(secuencia++).toString(36)}`;

@Injectable()
export class SimuladorDePlanificacion {
  private readonly store = inject(AppStore);
  private readonly i18n = inject(I18nService);

  private readonly api = inject(FinanceApiClient);
  private readonly capabilities = inject(CAPABILITIES);
  private readonly escrituras = inject(ApiWritesBus);

  readonly hoy = computed(() => this.store.hoy());
  readonly manana = computed(() => addDaysToIso(this.hoy(), 1));
  readonly limiteDeFechas = computed(() => addMonthsToIso(this.hoy(), 12 * 50));
  private readonly rangoMedido = computed(() => ({
    start: `${addMonthsToIso(this.hoy(), -3).slice(0, 7)}-01`,
    end: this.hoy(),
  }));
  private readonly delPeriodo = crearMovimientosDelPeriodo(this.rangoMedido);
  readonly cargandoMovimientos = this.delPeriodo.cargando;
  readonly flujoMedido = computed(() => flujoPromedio(this.delPeriodo.movimientos(), this.hoy()));
  readonly obligaciones = signal<readonly ApiObligation[]>([]);
  private readonly traerObligaciones = effect(() => {
    this.escrituras.version();
    if (this.store.remoteState() !== 'ready') return;
    if (!this.capabilities.allows(P.personas.obligaciones.listar)) return;
    untracked(() => {
      void firstValueFrom(this.api.obligations())
        .then((lista) => this.obligaciones.set(lista))
        .catch(() => this.obligaciones.set([]));
    });
  });
  readonly movimientosDeTarjetas = signal<readonly Movement[] | null>(null);
  private readonly traerTarjetas = effect(() => {
    this.escrituras.version();
    if (this.store.remoteState() !== 'ready') return;
    const tarjetas = this.store
      .data()
      .accounts.filter((a) => a.type === 'credit')
      .map((a) => a.id);
    untracked(() => {
      void traerMovimientosDeTarjetas(this.api, this.i18n, this.store.kindCatalog(), tarjetas)
        .then((lista) => this.movimientosDeTarjetas.set(lista))
        .catch(() => this.movimientosDeTarjetas.set(null));
    });
  });
  readonly recurrentesApi = signal<readonly ApiRecurrence[]>([]);
  private readonly traerRecurrentes = effect(() => {
    this.escrituras.version();
    if (this.store.remoteState() !== 'ready') return;
    if (!this.capabilities.allows(P.calendario.recurrencias.listar)) return;
    untracked(() => {
      void firstValueFrom(this.api.recurrences())
        .then((lista) => this.recurrentesApi.set(lista as readonly ApiRecurrence[]))
        .catch(() => this.recurrentesApi.set([]));
    });
  });
  readonly recorte = signal(0);
  readonly categorias = computed(() => lineasPorCategoria(this.delPeriodo.movimientos(), this.hoy()));
  readonly ajustesDeLinea = signal<Readonly<Record<string, AjusteDeLinea>>>({});
  readonly recurrentes = computed(() => recurrentesDeFlujo(this.recurrentesApi(), this.hoy()));
  readonly recurrentesQuitados = signal<ReadonlySet<string>>(new Set());
  readonly cambiosDeFlujo = signal<readonly CambioDeFlujo[]>([]);
  readonly vista = signal<VistaDeGrafica>('original');
  readonly medidaDeComparacion = signal<MedidaDeComparacion>('saldoTotal');
  readonly escenariosGuardados = signal<readonly EscenarioGuardado[]>([]);

  private readonly porConcepto = computed(() => {
    const movimientos = this.movimientosDeTarjetas();
    return movimientos
      ? {
          movimientos,
          etiqueta: (concepto: number) => this.i18n.t(`card.bucket.${claveDeConcepto(concepto) ?? 'fees'}`),
        }
      : undefined;
  });
  readonly deudasReales = computed(() =>
    deudasActuales(
      this.store.data().accounts,
      this.store.data().people,
      this.store.data().movements,
      (c) => this.store.balance(c),
      this.obligaciones(),
      this.hoy(),
      this.porConcepto(),
    ),
  );
  readonly ajustes = signal<Readonly<Record<string, AjusteDeDeuda>>>({});
  readonly excluidas = signal<ReadonlySet<string>>(new Set());
  readonly hipoteticas = signal<readonly Deuda[]>([]);
  readonly abonoMensual = signal(0);
  readonly orden = signal<OrdenDeAbono>('tasa');
  readonly eventos = signal<readonly EventoDelEscenario[]>([]);
  readonly fechaSinDeudas = linkedSignal(() => addMonthsToIso(this.hoy(), 24));

  readonly compraMonto = signal(0);
  readonly compraNombre = signal('');
  readonly compraCuotas = signal(CUOTAS_SUPUESTAS);
  readonly compraTasa = signal(TASA_MENSUAL_SUPUESTA_TARJETA);
  readonly compraMes = signal(0);

  readonly metaMonto = signal(0);
  readonly metaFecha = linkedSignal(() => addMonthsToIso(this.hoy(), 12));

  readonly valorInvertido = computed(() => sumBy(this.store.data().investments, (i) => i.value));
  readonly inversionInicial = linkedSignal(() => this.valorInvertido());
  readonly inversionAporte = signal(0);
  readonly inversionTasa = linkedSignal(() =>
    tasaPromedioDeInversiones(this.store.data().investments, RENDIMIENTO_SUPUESTO),
  );
  readonly inversionFecha = linkedSignal(() => addMonthsToIso(this.hoy(), 60));

  readonly deudasDeHoy = computed<DeudaActual[]>(() =>
    this.deudasReales()
      .filter((d) => !this.excluidas().has(d.id))
      .map((d) => ({ ...d, ...this.ajustes()[d.id] })),
  );

  readonly compra = computed<Deuda | null>(() =>
    this.compraMonto() > 0
      ? {
          id: ID_DE_LA_COMPRA,
          nombre: this.compraNombre().trim() || this.i18n.t('planning.sim.purchase.defaultName'),
          tipo: 'hipotetica',
          saldo: this.compraMonto(),
          tasaMensual: this.compraTasa(),
          cuotas: Math.max(1, this.compraCuotas()),
          desdeMes: Math.max(0, this.compraMes()),
        }
      : null,
  );

  readonly deudasDelEscenario = computed<Deuda[]>(() => {
    const compra = this.compra();
    return [...this.deudasDeHoy(), ...this.hipoteticas(), ...(compra ? [compra] : [])];
  });

  readonly flujoMensual = computed(() =>
    flujoPorMes(
      this.categorias(),
      this.ajustesDeLinea(),
      this.recurrentes().filter((r) => this.recurrentesQuitados().has(r.id)),
      this.cambiosDeFlujo(),
      this.meses(),
    ),
  );
  private readonly flujoMensualSinCambios = computed(() => flujoPorMes(this.categorias(), {}, [], [], this.meses()));

  private readonly flujo = computed(() => ({
    ingresoMensual: this.flujoMensual().ingreso[0] ?? 0,
    gastoMensual: this.flujoMensual().gasto[0] ?? 0,
    ingresoPorMes: this.flujoMensual().ingreso,
    gastoPorMes: this.flujoMensual().gasto,
    recorteDeGasto: this.recorte(),
    metaDeAhorro: this.metaMonto(),
  }));

  private readonly flujoSinCambios = computed(() => ({
    ingresoMensual: this.flujoMensualSinCambios().ingreso[0] ?? 0,
    gastoMensual: this.flujoMensualSinCambios().gasto[0] ?? 0,
    ingresoPorMes: this.flujoMensualSinCambios().ingreso,
    gastoPorMes: this.flujoMensualSinCambios().gasto,
    recorteDeGasto: 0,
    metaDeAhorro: this.metaMonto(),
  }));

  readonly mesesAlObjetivo = computed(() => mesesHasta(this.hoy(), this.fechaSinDeudas()));
  readonly mesesAlaMeta = computed(() => mesesHasta(this.hoy(), this.metaFecha()));
  readonly mesesDeInversion = computed(() => Math.min(600, mesesHasta(this.hoy(), this.inversionFecha())));

  readonly meses = computed(() =>
    Math.max(
      MESES_MINIMOS,
      horizonteDeDeudas(this.deudasDelEscenario(), 6),
      this.mesesAlaMeta() + 3,
      this.mesesAlObjetivo() + 3,
    ),
  );

  readonly etiquetas = computed(() => this.etiquetasDesdeHoy(this.meses()));
  readonly etiquetasDeInversion = computed(() => this.etiquetasDesdeHoy(this.mesesDeInversion() + 1));

  readonly planDeAbono = computed<Palanca[]>(() =>
    planDeAbonos(this.deudasDelEscenario(), this.flujo(), this.meses(), this.abonoMensual(), this.orden()),
  );

  readonly palancas = computed<Palanca[]>(() => [...this.eventos(), ...this.planDeAbono()]);

  readonly base = computed<Proyeccion>(() => proyectar(this.deudasDeHoy(), [], this.flujoSinCambios(), this.meses()));
  readonly escenario = computed<Proyeccion>(() =>
    proyectar(this.deudasDelEscenario(), this.palancas(), this.flujo(), this.meses()),
  );

  readonly deudaTotal = computed(() =>
    sumBy(
      this.deudasDelEscenario().filter((d) => !d.desdeMes),
      (d) => d.saldo,
    ),
  );
  readonly cuotaNecesaria = computed(() => cuotaParaTerminarEn(this.deudasDelEscenario(), this.mesesAlObjetivo()));
  readonly cuotaDelPrimerMes = computed(() => this.escenario().cuotaTotal[0] ?? 0);
  readonly interesAhorrado = computed(() => Math.round(this.base().interesTotal - this.escenario().interesTotal));

  readonly cuotaDeLaCompra = computed(() => {
    const compra = this.compra();
    return compra ? Math.round(cuotaFija(compra.saldo, compra.tasaMensual, compra.cuotas)) : 0;
  });
  readonly serieDeLaCompra = computed(() => this.escenario().deudas.find((d) => d.id === ID_DE_LA_COMPRA) ?? null);
  readonly flujoLibreMinimo = computed(() => Math.min(...this.escenario().flujoLibre));
  readonly flujoLibreMinimoBase = computed(() => Math.min(...this.base().flujoLibre));

  readonly aporteNecesarioMeta = computed(() => Math.round(this.metaMonto() / Math.max(1, this.mesesAlaMeta())));
  readonly flujoLibrePromedio = computed(() => {
    const tramo = this.escenario().flujoLibre.slice(0, this.mesesAlaMeta());
    return tramo.length ? Math.round(sumBy(tramo, (v) => v) / tramo.length) : 0;
  });

  readonly inversion = computed(() =>
    proyectarInversion(this.inversionInicial(), this.inversionAporte(), this.inversionTasa(), this.mesesDeInversion()),
  );

  etiquetaDeMes(mes: number | null): string {
    return mes === null ? this.i18n.t('planning.sim.never') : (this.etiquetas()[mes] ?? '');
  }

  ajustar(id: string, ajuste: AjusteDeDeuda): void {
    if (id.startsWith('hipotetica:')) {
      this.hipoteticas.update((lista) => lista.map((d) => (d.id === id ? { ...d, ...ajuste } : d)));
      return;
    }
    this.ajustes.update((actual) => ({ ...actual, [id]: { ...actual[id], ...ajuste } }));
  }

  alternarDeuda(id: string, incluida: boolean): void {
    this.excluidas.update((actual) => {
      const siguiente = new Set(actual);
      if (incluida) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  agregarDeuda(): void {
    const numero = this.hipoteticas().length + 1;
    this.hipoteticas.update((lista) => [
      ...lista,
      {
        id: nuevoId('hipotetica'),
        nombre: this.i18n.t('planning.sim.debt.newName', { n: numero }),
        tipo: 'hipotetica',
        saldo: 1_000_000,
        tasaMensual: TASA_MENSUAL_SUPUESTA_TARJETA,
        cuotas: CUOTAS_SUPUESTAS,
      },
    ]);
  }

  renombrarHipotetica(id: string, nombre: string): void {
    this.hipoteticas.update((lista) => lista.map((d) => (d.id === id ? { ...d, nombre } : d)));
  }

  quitarHipotetica(id: string): void {
    this.hipoteticas.update((lista) => lista.filter((d) => d.id !== id));
    this.eventos.update((lista) => lista.filter((e) => e.deudaId !== id));
  }

  agregarEvento(tipo: EventoDelEscenario['tipo']): void {
    const deuda = this.deudasDelEscenario()[0];
    if (!deuda) return;
    const evento: EventoDelEscenario =
      tipo === 'abono'
        ? { tipo, id: nuevoId('evento'), deudaId: deuda.id, mes: 3, monto: 500_000 }
        : { tipo, id: nuevoId('evento'), deudaId: deuda.id, mes: 3, tasaMensual: Math.max(0, deuda.tasaMensual - 0.5) };
    this.eventos.update((lista) => [...lista, evento]);
  }

  editarEvento(
    id: string,
    cambio: Partial<Pick<EventoDelEscenario, 'deudaId' | 'mes'>> & { monto?: number; tasaMensual?: number },
  ): void {
    this.eventos.update((lista) =>
      lista.map((e) => {
        if (e.id !== id) return e;
        const comun = { deudaId: cambio.deudaId ?? e.deudaId, mes: cambio.mes ?? e.mes };
        return e.tipo === 'abono'
          ? { ...e, ...comun, monto: cambio.monto ?? e.monto }
          : { ...e, ...comun, tasaMensual: cambio.tasaMensual ?? e.tasaMensual };
      }),
    );
  }

  quitarEvento(id: string): void {
    this.eventos.update((lista) => lista.filter((e) => e.id !== id));
  }

  restablecer(): void {
    this.ajustes.set({});
    this.excluidas.set(new Set());
    this.hipoteticas.set([]);
    this.eventos.set([]);
    this.abonoMensual.set(0);
    this.recorte.set(0);
    this.ajustesDeLinea.set({});
    this.recurrentesQuitados.set(new Set());
    this.cambiosDeFlujo.set([]);
    this.compraMonto.set(0);
    this.metaMonto.set(0);
    this.inversionAporte.set(0);
    this.inversionInicial.set(this.valorInvertido());
  }

  ajustarLinea(id: string, ajuste: Partial<AjusteDeLinea>, montoOriginal: number): void {
    this.ajustesDeLinea.update((actual) => {
      const previo = actual[id] ?? { incluida: true, monto: montoOriginal };
      return { ...actual, [id]: { ...previo, ...ajuste } };
    });
  }

  lineaVigente(id: string, montoOriginal: number): AjusteDeLinea {
    return this.ajustesDeLinea()[id] ?? { incluida: true, monto: montoOriginal };
  }

  alternarRecurrente(id: string, quitado: boolean): void {
    this.recurrentesQuitados.update((actual) => {
      const siguiente = new Set(actual);
      if (quitado) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });
  }

  agregarCambio(tipo: CambioDeFlujo['tipo']): void {
    const numero = this.cambiosDeFlujo().length + 1;
    const clave = tipo === 'ingreso' ? 'planning.sim.flow.newIncome' : 'planning.sim.flow.newExpense';
    this.cambiosDeFlujo.update((lista) => [
      ...lista,
      { id: nuevoId('cambio'), nombre: this.i18n.t(clave, { n: numero }), tipo, monto: 200_000, desde: 1, hasta: null },
    ]);
  }

  editarCambio(id: string, cambio: Partial<Omit<CambioDeFlujo, 'id'>>): void {
    this.cambiosDeFlujo.update((lista) => lista.map((c) => (c.id === id ? { ...c, ...cambio } : c)));
  }

  quitarCambio(id: string): void {
    this.cambiosDeFlujo.update((lista) => lista.filter((c) => c.id !== id));
  }

  guardarEscenario(nombre: string): void {
    const escenario = this.escenario();
    this.escenariosGuardados.update((lista) => [
      ...lista.slice(-5),
      {
        id: nuevoId('escenario'),
        nombre: nombre.trim() || this.i18n.t('planning.sim.compare.defaultName', { n: lista.length + 1 }),
        saldoTotal: escenario.saldoTotal,
        ahorroAcumulado: escenario.ahorroAcumulado,
        flujoLibre: escenario.flujoLibre,
      },
    ]);
  }

  quitarEscenario(id: string): void {
    this.escenariosGuardados.update((lista) => lista.filter((e) => e.id !== id));
  }

  readonly escenariosAComparar = computed<EscenarioGuardado[]>(() => [
    {
      id: 'actual',
      nombre: this.i18n.t('planning.sim.series.scenario'),
      saldoTotal: this.escenario().saldoTotal,
      ahorroAcumulado: this.escenario().ahorroAcumulado,
      flujoLibre: this.escenario().flujoLibre,
    },
    {
      id: 'base',
      nombre: this.i18n.t('planning.sim.series.base'),
      saldoTotal: this.base().saldoTotal,
      ahorroAcumulado: this.base().ahorroAcumulado,
      flujoLibre: this.base().flujoLibre,
    },
    ...this.escenariosGuardados(),
  ]);

  readonly estado = computed(() =>
    JSON.stringify({
      version: 1,
      recorte: this.recorte(),
      ajustesDeLinea: this.ajustesDeLinea(),
      recurrentesQuitados: [...this.recurrentesQuitados()],
      cambiosDeFlujo: this.cambiosDeFlujo(),
      vista: this.vista(),
      medidaDeComparacion: this.medidaDeComparacion(),
      escenariosGuardados: this.escenariosGuardados(),
      ajustes: this.ajustes(),
      excluidas: [...this.excluidas()],
      hipoteticas: this.hipoteticas(),
      abonoMensual: this.abonoMensual(),
      orden: this.orden(),
      eventos: this.eventos(),
      fechaSinDeudas: this.fechaSinDeudas(),
      compra: {
        monto: this.compraMonto(),
        nombre: this.compraNombre(),
        cuotas: this.compraCuotas(),
        tasa: this.compraTasa(),
        mes: this.compraMes(),
      },
      meta: { monto: this.metaMonto(), fecha: this.metaFecha() },
      inversion: {
        inicial: this.inversionInicial(),
        aporte: this.inversionAporte(),
        tasa: this.inversionTasa(),
        fecha: this.inversionFecha(),
      },
    }),
  );

  restaurar(json: string | null): void {
    this.restablecer();
    this.escenariosGuardados.set([]);
    if (!json) return;
    let guardado: EstadoGuardado;
    try {
      guardado = JSON.parse(json) as EstadoGuardado;
    } catch {
      return;
    }
    if (guardado?.version !== 1) return;
    this.recorte.set(guardado.recorte ?? 0);
    this.ajustesDeLinea.set(guardado.ajustesDeLinea ?? {});
    this.recurrentesQuitados.set(new Set(guardado.recurrentesQuitados ?? []));
    this.cambiosDeFlujo.set(guardado.cambiosDeFlujo ?? []);
    this.vista.set(guardado.vista ?? 'original');
    this.medidaDeComparacion.set(guardado.medidaDeComparacion ?? 'saldoTotal');
    this.escenariosGuardados.set(guardado.escenariosGuardados ?? []);
    this.ajustes.set(guardado.ajustes ?? {});
    this.excluidas.set(new Set(guardado.excluidas ?? []));
    this.hipoteticas.set(guardado.hipoteticas ?? []);
    this.abonoMensual.set(guardado.abonoMensual ?? 0);
    this.orden.set(guardado.orden ?? 'tasa');
    this.eventos.set(guardado.eventos ?? []);
    if (guardado.fechaSinDeudas) this.fechaSinDeudas.set(guardado.fechaSinDeudas);
    if (guardado.compra) {
      this.compraMonto.set(guardado.compra.monto);
      this.compraNombre.set(guardado.compra.nombre);
      this.compraCuotas.set(guardado.compra.cuotas);
      this.compraTasa.set(guardado.compra.tasa);
      this.compraMes.set(guardado.compra.mes);
    }
    if (guardado.meta) {
      this.metaMonto.set(guardado.meta.monto);
      this.metaFecha.set(guardado.meta.fecha);
    }
    if (guardado.inversion) {
      this.inversionInicial.set(guardado.inversion.inicial);
      this.inversionAporte.set(guardado.inversion.aporte);
      this.inversionTasa.set(guardado.inversion.tasa);
      this.inversionFecha.set(guardado.inversion.fecha);
    }
  }

  private etiquetasDesdeHoy(cantidad: number): string[] {
    const formato = new Intl.DateTimeFormat(this.store.preferences().locale, {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    });
    const [anio, mes] = this.hoy().split('-').map(Number);
    return Array.from({ length: cantidad }, (_, i) => formato.format(new Date(Date.UTC(anio, mes - 1 + i, 1))));
  }
}
