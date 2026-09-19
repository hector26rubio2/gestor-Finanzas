import { DestroyRef, Injectable, inject } from '@angular/core';
import { Observable, ObservedValueOf, catchError, firstValueFrom, forkJoin, map, of } from 'rxjs';
import { Account, DemoData, Movement } from '../state/demo-data';
import {
  ApiAccount,
  ApiAccountKind,
  ApiCard,
  ApiDebtPosition,
  ApiInvestment,
  ApiMovement,
  ApiNotification,
  ApiRequestError,
  ApiSession,
  FinanceApiClient,
} from '../api/api-client';
import { parseAmount, parseMoney, parseRate } from '../utils/money';
import { classifyFamily, MovementKindCatalog, signOf } from '../utils/movement-kinds';
import { P } from './permissions';
import { Router } from '@angular/router';
import { AppStore } from '../state/store';
import { I18nService } from '../i18n/i18n.service';

type Rebanada =
  | 'movementKinds'
  | 'accounts'
  | 'cards'
  | 'categories'
  | 'people'
  | 'debts'
  | 'investments'
  | 'movements'
  | 'preferences';
const SLICES: readonly Rebanada[] = [
  'movementKinds',
  'accounts',
  'cards',
  'categories',
  'people',
  'debts',
  'investments',
  'movements',
  'preferences',
];
/** Permiso que autoriza pedir cada rebanada: el mismo código que exige el endpoint. */
const PERMISO_DE: Record<Rebanada, string> = {
  movementKinds: P.movimientos.clases.listar,
  accounts: P.cuentas.ver,
  cards: P.cuentas.tarjetas.listar,
  categories: P.cuentas.categorias.listar,
  people: P.personas.ver,
  debts: P.personas.deudas.listar,
  investments: P.patrimonio.ver,
  movements: P.movimientos.ver,
  preferences: P.preferencias.ver,
};

interface RawData {
  movementKinds: ObservedValueOf<ReturnType<FinanceApiClient['movementKinds']>>;
  accounts: ObservedValueOf<ReturnType<FinanceApiClient['accounts']>>;
  cards: ObservedValueOf<ReturnType<FinanceApiClient['cards']>>;
  categories: ObservedValueOf<ReturnType<FinanceApiClient['categories']>>;
  people: ObservedValueOf<ReturnType<FinanceApiClient['people']>>;
  debts: ObservedValueOf<ReturnType<FinanceApiClient['debts']>>;
  investments: ObservedValueOf<ReturnType<FinanceApiClient['investments']>>;
  movements: ObservedValueOf<ReturnType<FinanceApiClient['movements']>>;
  preferences: ObservedValueOf<ReturnType<FinanceApiClient['preferences']>> | null;
  notifications: ObservedValueOf<ReturnType<FinanceApiClient['notifications']>>;
}

function emptyRaw(): RawData {
  return {
    movementKinds: [],
    accounts: [],
    cards: [],
    categories: [],
    people: [],
    debts: [],
    investments: [],
    movements: { items: [], page: 1, size: 25, total: 0, totalPages: 0, hasNext: false },
    preferences: null,
    notifications: [],
  };
}

/** Persona y organización: si cambia una de las dos, los datos cargados ya no valen. */
function identidadDe(session: ApiSession): string {
  return `${session.user.id}|${session.organization.id}`;
}

function mismaLista(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((valor, i) => valor === b[i]);
}

@Injectable({ providedIn: 'root' })
export class RemoteBootstrap {
  private readonly api = inject(FinanceApiClient);
  private readonly store = inject(AppStore);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private started = false;

  /**
   * Canal en vivo abierto, si lo hay. Se guarda para poder cerrarlo: al cerrar sesion
   * seguia conectado y reintentando contra un endpoint que ya devolvia 401.
   */
  private canal: EventSource | null = null;

  /**
   * Si la sesion se cerro a proposito.
   *
   * El sondeo y el canal seguian vivos despues de cerrar sesion, y ninguno sabia que la
   * persona se habia ido: bastaba con que la siguiente lectura de la sesion devolviera
   * algo —una cookie que todavia no habia caducado, una peticion en vuelo— para volver a
   * entrar solo. Cerrar sesion tiene que ganarle a cualquier ciclo en marcha.
   */
  private cerradaAProposito = false;

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.store.restoreDemoSession();
    await this.initialize();
    if (this.store.runtime.mode !== 'api') return;
    // El sondeo se queda como respaldo: cubre el canal caido, el navegador sin
    // EventSource y el despliegue con mas de una instancia, donde el aviso puede salir
    // por una maquina distinta de la que atiende esta pestana.
    if (this.destroyRef.destroyed) return;
    const timer = window.setInterval(() => void this.pollSession(), 60_000);
    const onFocus = () => void this.pollSession();
    window.addEventListener('focus', onFocus);
    this.destroyRef.onDestroy(() => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      this.canal?.close();
      this.canal = null;
    });
    this.escucharCambiosDeAcceso();
  }

  /** Identidad de la sesión cargada: si cambia, hay que empezar de cero y no solo refrescar. */
  private identidad: string | null = null;
  /** Permisos de la sesión cargada, para saber qué datos se conceden o se quitan al refrescar. */
  private permisos = new Set<string>();
  private refrescando = false;
  private raw: RawData = emptyRaw();

  /**
   * Carga completa: primera vez, al entrar y cuando cambia la persona o la organización.
   * Es la única que pone `remoteState` en «loading» y, con él, el indicador de carga.
   */
  async initialize(): Promise<void> {
    if (this.store.runtime.mode !== 'api') return;
    this.cerradaAProposito = false;
    this.store.remoteState.set('loading');
    try {
      const session = await firstValueFrom(this.api.session());

      // Sin permisos el menu sale vacio y ninguna ruta abre. Antes eso ocurria en
      // silencio y parecia una aplicacion rota; ahora se dice lo que pasa.
      if (!session.permissions?.length) {
        this.store.remoteError.set(
          'La sesión no trae permisos. Pide a quien administra que revise tus roles o tu membresía.',
        );
        this.store.remoteState.set('error');
        this.store.user.set(null);
        return;
      }

      this.identidad = identidadDe(session);
      this.permisos = new Set(session.permissions);

      // Cada petición se hace si su permiso está concedido, y el permiso es el mismo
      // código que exige el endpoint. Antes se decidía con la máscara numérica de
      // capacidades, que un rol granular deja vacía: conceder «ver movimientos» y nada más
      // ponía la entrada en el menú y luego no pedía los movimientos.
      const claves = SLICES.filter((clave) => this.permisos.has(PERMISO_DE[clave]));
      const result = await firstValueFrom(
        forkJoin({
          datos: this.pedirRebanadas(claves),
          // Los valores efectivos no son una pantalla administrativa: toda sesión los
          // necesita para decidir qué rutas puede ofrecer. Sin ellos no hay menú.
          featureFlags: this.api.featureFlags(),
          notifications: this.api.notifications().pipe(catchError(() => of([]))),
        }),
      );
      this.raw = { ...emptyRaw(), ...result.datos, notifications: result.notifications };
      this.aplicarDatos();
      this.aplicarSesion(session, result.featureFlags);
      this.store.remoteState.set('ready');
      // Tras volver a entrar, el canal se reabre: al cerrar sesion se cerro a proposito.
      this.escucharCambiosDeAcceso();
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        const authError = this.consumeAuthError();
        this.store.remoteError.set(authError ?? '');
        this.store.user.set(null);
        this.store.remoteState.set(authError ? 'error' : 'anonymous');
        return;
      }
      this.store.remoteError.set(error instanceof Error ? error.message : 'No fue posible cargar la API.');
      this.store.remoteState.set('error');
      this.store.user.set(null);
    }
  }

  /**
   * Trae las rebanadas de datos pedidas. Un fallo en una no anula la sesión: esa lista queda
   * vacía y se avisa una vez. Antes cualquier error no crítico (una lista con 403 o 500)
   * dejaba `user` en null y el guard mandaba al login, perdiendo la vista.
   */
  private pedirRebanadas(claves: readonly Rebanada[]): Observable<Partial<RawData>> {
    if (!claves.length) return of({});
    let fallos = 0;
    const pedidas: Record<string, Observable<unknown>> = {};
    for (const clave of claves) {
      pedidas[clave] = this.pedir(clave).pipe(
        catchError(() => {
          fallos++;
          return of(emptyRaw()[clave]);
        }),
      );
    }
    return forkJoin(pedidas).pipe(
      map((datos) => {
        if (fallos) this.store.toast.set(this.i18n.t('shell.partialLoad'));
        return datos as Partial<RawData>;
      }),
    );
  }

  private pedir(clave: Rebanada): Observable<unknown> {
    switch (clave) {
      case 'movementKinds':
        return this.api.movementKinds();
      case 'accounts':
        return this.api.accounts();
      case 'cards':
        return this.api.cards();
      case 'categories':
        return this.api.categories();
      case 'people':
        return this.api.people();
      case 'debts':
        return this.api.debts();
      case 'investments':
        return this.api.investments();
      case 'movements':
        return this.api.movements({ page: 1, pageSize: 25 });
      case 'preferences':
        return this.api.preferences();
    }
  }

  /** Vuelca las rebanadas cargadas al store. Es lo único que reescribe `store.data`. */
  private aplicarDatos(): void {
    const raw = this.raw;
    // El catálogo entra antes que los movimientos: la familia de cada clase se
    // deriva de la tabla publicada, no de números escritos a mano en el cliente.
    const catalog = new MovementKindCatalog(raw.movementKinds);
    this.store.kindCatalog.set(catalog);
    this.store.data.set(
      this.toViewData(
        catalog,
        raw.accounts,
        raw.cards,
        raw.movements.items,
        raw.people,
        raw.debts,
        raw.investments,
        raw.notifications,
      ),
    );
    this.store.remoteMovementPage.set(raw.movements.page);
    this.store.remoteMovementSize.set(raw.movements.size);
    this.store.remoteMovementTotal.set(raw.movements.total);
    this.store.categories.set(raw.categories);
    if (raw.preferences) {
      const preferences = raw.preferences;
      let custom: { accent?: string; radius?: number } = {};
      try {
        custom = preferences.customThemeJson ? JSON.parse(preferences.customThemeJson) : {};
      } catch {
        custom = {};
      }
      this.store.preferences.update((value) => ({
        ...value,
        locale: preferences.language,
        theme: preferences.theme as typeof value.theme,
        font: preferences.font,
        density: preferences.density as typeof value.density,
        accent: custom.accent ?? value.accent,
        radius: custom.radius ?? value.radius,
      }));
    }
  }

  /**
   * Publica la sesión y las banderas solo si cambiaron. Cada `set` con un valor equivalente
   * despertaba a todo lo que lee `store.user()` —el menú lateral incluido— y, con él, la
   * pantalla activa; comparando antes solo se actualiza lo que de verdad cambió.
   */
  private aplicarSesion(session: ApiSession, flags: readonly { key: string; isEnabled: boolean }[]): void {
    const user = this.toViewUser(session);
    const actual = this.store.user();
    const igual =
      !!actual &&
      actual.id === user.id &&
      actual.name === user.name &&
      actual.email === user.email &&
      actual.photoUrl === user.photoUrl &&
      mismaLista(actual.capabilities, user.capabilities);
    if (!igual) this.store.user.set(user);

    const organization = { id: session.organization.id, name: session.organization.name };
    const org = this.store.organization();
    if (!org || org.id !== organization.id || org.name !== organization.name) this.store.organization.set(organization);

    const organizations = (session.organizations ?? []).map((x) => ({ id: x.id, name: x.name }));
    if (JSON.stringify(organizations) !== JSON.stringify(this.store.organizations()))
      this.store.organizations.set(organizations);

    const banderas = Object.fromEntries(flags.map((flag) => [flag.key, flag.isEnabled]));
    if (JSON.stringify(banderas) !== JSON.stringify(this.store.featureFlags())) this.store.featureFlags.set(banderas);
    this.store.featureFlagsLoaded.set(true);
  }

  /**
   * Refresca lo que cambió sin recargar la aplicación: relee la sesión y las banderas,
   * trae solo los datos de los permisos recién concedidos, vacía los de los retirados y
   * publica el resultado. No toca `remoteState`, así que no aparece el indicador de carga
   * ni se destruye la pantalla activa; si un permiso cambia, solo se repinta lo que lo lee
   * (el menú lateral, por ejemplo). Si cambió la persona o la organización, recarga todo.
   */
  private async cargarSesion(): Promise<void> {
    if (this.cerradaAProposito || this.store.runtime.mode !== 'api') return;
    if (this.store.remoteState() === 'loading' || this.refrescando) return;
    this.refrescando = true;
    try {
      const [session, flags] = await firstValueFrom(forkJoin([this.api.session(), this.api.featureFlags()]));
      if (this.identidad !== null && identidadDe(session) !== this.identidad) {
        this.refrescando = false;
        await this.initialize();
        return;
      }

      const ahora = new Set(session.permissions ?? []);
      const concedidas = SLICES.filter((c) => ahora.has(PERMISO_DE[c]) && !this.permisos.has(PERMISO_DE[c]));
      const retiradas = SLICES.filter((c) => !ahora.has(PERMISO_DE[c]) && this.permisos.has(PERMISO_DE[c]));
      const vacio = emptyRaw();
      for (const clave of retiradas) this.raw = { ...this.raw, [clave]: vacio[clave] };
      if (concedidas.length) {
        const nuevas = await firstValueFrom(this.pedirRebanadas(concedidas));
        this.raw = { ...this.raw, ...nuevas };
      }
      this.permisos = ahora;
      if (concedidas.length || retiradas.length) this.aplicarDatos();
      this.aplicarSesion(session, flags);
    } catch {
      /* los errores transitorios se ignoran; el próximo ciclo reintenta */
    } finally {
      this.refrescando = false;
    }
  }

  /**
   * Si el callback de Google falló del lado del backend, redirige de vuelta con
   * `?authError=1` en vez de dejar a la persona viendo el JSON crudo de la API. Sin
   * esto, la sesión simplemente volvía a "anonymous" y la pantalla de login no decía
   * nada de lo que había pasado.
   */
  private consumeAuthError(): string | null {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('authError')) return null;
    params.delete('authError');
    const query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : ''));
    return this.i18n.t('login.authError');
  }

  /** Revisa la sesión y recarga todo cuando un administrador cambia los permisos. */
  /**
   * Escucha el canal en vivo de cambios de acceso.
   *
   * Sin esto, quitar un permiso tardaba hasta un minuto en verse: el servidor ya
   * rechazaba la peticion —la cookie se revalida contra la base en cada llamada— pero la
   * pantalla seguia ofreciendo la entrada de menu retirada, que es peor que no mostrarla
   * porque invita a intentarlo.
   *
   * Eventos del servidor y no un socket: el flujo va en un solo sentido y EventSource ya
   * trae reconexion automatica. El aviso no lleva datos; solo dice que hay que releer.
   */
  private escucharCambiosDeAcceso(): void {
    if (this.store.runtime.mode !== 'api' || typeof EventSource === 'undefined') return;
    if (this.canal) return;
    try {
      this.canal = new EventSource(`${this.store.runtime.apiBaseUrl}/api/v1/events`, {
        withCredentials: true,
      });
      this.canal.addEventListener('permisos', () => {
        if (!this.cerradaAProposito) void this.cargarSesion();
      });
    } catch {
      // Si el canal no se puede abrir, queda el sondeo.
      this.canal = null;
    }
  }

  /**
   * Cierra la sesion y devuelve a la pantalla de acceso.
   *
   * Estaba escrito dos veces —en el menu de perfil y en Preferencias— y las dos copias
   * habian divergido: la de Preferencias no olvidaba el perfil demo, asi que en modo
   * local seguias dentro, y si la llamada al servidor fallaba se rendia sin limpiar
   * nada, dejandote autenticado en pantalla. Una sola implementacion no puede divergir.
   *
   * Si el servidor no responde, la sesion local se cierra igual: quedarse dentro porque
   * la red fallo es lo contrario de lo que pide quien pulsa «cerrar sesion». La cookie
   * caduca por su cuenta.
   */
  async cerrarSesion(): Promise<void> {
    // Antes que nada: corta los ciclos que podrian volver a entrar mientras se cierra.
    this.cerradaAProposito = true;
    this.identidad = null;
    this.permisos = new Set();
    this.raw = emptyRaw();
    this.canal?.close();
    this.canal = null;

    if (this.store.runtime.mode === 'api') {
      try {
        await firstValueFrom(this.api.logout());
      } catch {
        /* la sesion local se cierra igual; el servidor la caducara */
      }
    }
    this.store.remoteState.set('anonymous');
    this.store.forgetDemoSession();
    this.store.user.set(null);
    this.store.form.set(null);
    this.store.inspector.set(null);
    await this.router.navigateByUrl('/login');
  }

  /** Revisa la sesión (sondeo, foco de la ventana y cambios hechos desde Administración). */
  async pollSession(): Promise<void> {
    await this.cargarSesion();
  }

  private toViewUser(session: ApiSession): (typeof this.store.users)[number] & { photoUrl?: string } {
    return {
      id: session.user.id,
      name: session.user.displayName,
      email: session.user.email,
      capabilities: [...(session.permissions ?? [])],
      photoUrl: session.user.pictureUrl ?? undefined,
    };
  }

  private toViewData(
    catalog: MovementKindCatalog,
    accounts: readonly ApiAccount[],
    cards: readonly ApiCard[],
    movements: readonly ApiMovement[],
    people: readonly { id: string; displayName: string }[],
    debts: readonly ApiDebtPosition[],
    investments: readonly ApiInvestment[],
    notifications: readonly ApiNotification[],
  ): DemoData {
    const viewAccounts: Account[] = [
      ...accounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.kind === ApiAccountKind.cash ? ('cash' as const) : ('savings' as const),
        currency: account.currency,
        openingBalance: 0,
        lastFour: account.lastFour ?? undefined,
        institution: account.institution ?? undefined,
      })),
      ...cards.map((card) => ({
        id: card.id,
        name: card.name,
        type: 'credit' as const,
        currency: card.currency,
        openingBalance: 0,
        limit: parseMoney(card.creditLimit),
        lastFour: card.lastFour ?? undefined,
        cutDay: card.cycle.statementDay,
        dueDay: card.cycle.paymentDueDay,
        // La tasa de compras la publica el servidor; la pantalla del extracto la usaba
        // inventada. Ausente si no viene: mejor no dar la cifra que darla falsa.
        annualRate: tasaAnual(card.terms?.purchaseApr?.value),
      })),
    ];
    const debtByPerson = new Map(debts.map((debt) => [debt.counterparty.id, debt]));
    // Los campos que la API todavía no expone se dejan ausentes a propósito.
    // Rellenarlos con constantes plausibles —riesgo «Medio», liquidez
    // «Programada», cero unidades— los presentaba en pantalla como si fueran
    // datos medidos. Un dato que falta se comunica; no se sustituye.
    return {
      accounts: viewAccounts,
      movements: movements.map((movement) => this.toMovement(catalog, movement)),
      people: people.map((person) => {
        const position = debtByPerson.get(person.id);
        return {
          id: person.id,
          name: person.displayName,
          owed: parseMoney(position?.receivable),
          owing: parseMoney(position?.ownDebt),
        };
      }),
      investments: investments.map((investment) => ({
        id: investment.id,
        name: investment.name,
        type: investment.instrumentType,
        cost: parseMoney(investment.costBasis),
        value: parseMoney(investment.marketValue ?? investment.costBasis),
        currency: investment.currency,
      })),
      notifications: notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        detail: this.notificationDetail(notification),
        read: notification.readAt !== null,
      })),
      auditEvents: [],
      featureFlags: {},
    };
  }

  private notificationDetail(notification: ApiNotification): string {
    try {
      const payload = JSON.parse(notification.payloadJson) as Record<string, unknown>;
      return String(payload['detail'] ?? payload['description'] ?? notification.kind);
    } catch {
      return notification.kind;
    }
  }

  private toMovement(catalog: MovementKindCatalog, source: ApiMovement): Movement {
    const accountId = source.links['account'] ?? source.links['card'] ?? '';
    const sign = signOf(source.flow, source.effect);
    const amount = parseMoney(source.amount.base) * sign;
    const family = catalog.family(source.kind, source.effect, source.flow);
    return {
      id: source.id,
      date: source.date,
      description: source.description ?? this.i18n.t('movements.fallback.noDescription'),
      accountId,
      category: source.linkNames['category']?.name ?? this.i18n.t('movements.fallback.noCategory'),
      ...classifyFamily(family, amount),
      amount,
      status: 'confirmed',
      person: source.linkNames['counterparty']?.name,
      ownership: source.links['counterparty'] ? 'loaned' : 'own',
      recurring: Boolean(source.links['recurrence']),
      originalCurrency: source.amount.original.currency === 'USD' ? 'USD' : 'COP',
      originalAmount: parseAmount(source.amount.original.amount, source.amount.original.currency),
      exchangeRate: parseRate(source.amount.rate),
    };
  }
}

/**
 * Tasa anual publicada por la API, o ausente.
 *
 * No se usa `parseRate` porque devuelve 0 cuando no hay valor, y 0 % es una tasa
 * legitima: confundir «no se» con «cero» es como se acaba enseñando una cifra inventada.
 */
function tasaAnual(valor: string | number | null | undefined): number | undefined {
  if (valor === null || valor === undefined) return undefined;
  const numero = typeof valor === 'number' ? valor : Number(valor.trim());
  return Number.isFinite(numero) ? numero : undefined;
}
