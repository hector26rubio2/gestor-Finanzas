import { todayIso } from '../utils/dates';
import { computed, inject, Injectable, InjectionToken, Injector, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { notifier } from '../notifications/notifier';
import { Account, accountBalance, createDemoData, createEmptyData, DemoData, demoUsers, Movement } from './demo-data';
import { ApiCategory, FinanceApiClient, viewTypeToAccountKind } from '../api/api-client';
import {
  baseCurrency as monedaBase,
  currencyCatalog as catalogoDeMonedas,
  formatAmount,
  parseMoney,
  sumBy,
} from '../utils/money';
import { I18nService } from '../i18n';
import { P } from '../session/permissions';
import { CashFlow, EconomicEffect, EMPTY_KIND_CATALOG, MovementKind, signOf } from '../utils/movement-kinds';
import { RUNTIME_CONFIG } from '../session/runtime';
import { DEMO_CATEGORIES } from './demo-categories';
import { PREFERENCES } from './theme';

export { applyTheme, PREFERENCES } from './theme';
import { paletteOverrides } from './theme';
export type { Preferences } from './theme';
export { navigation } from './navigation';

export interface DataProvider {
  load(): DemoData;
}
export const DATA_PROVIDER = new InjectionToken<DataProvider>('DataProvider', {
  providedIn: 'root',
  factory: () => ({ load: inject(RUNTIME_CONFIG).mode === 'demo' ? createDemoData : createEmptyData }),
});
export interface CapabilitiesProvider {
  allows(capability: string): boolean;
}
export const CAPABILITIES = new InjectionToken<CapabilitiesProvider>('Capabilities', {
  providedIn: 'root',
  factory: () => {
    const store = inject(AppStore);
    return { allows: (capability) => !!store.user()?.capabilities.includes(capability) };
  },
});
export const FEATURES = new InjectionToken<{ enabled(key: string): boolean }>('FeatureFlags', {
  providedIn: 'root',
  factory: () => {
    const store = inject(AppStore);
    return {
      // Una ruta funcional en modo API debe aparecer expresamente en el catálogo. La
      // única excepción es el plano de control: el superadmin necesita conservar la
      // vía para revertir una bandera mal configurada.
      enabled: (key) => {
        if (store.runtime.mode === 'api' && !store.featureFlagsLoaded()) return false;
        if (key === 'admin') return true;
        return store.runtime.mode === 'api' ? store.featureFlags()[key] === true : (store.featureFlags()[key] ?? true);
      },
    };
  },
});
const DEMO_SESSION_KEY = 'finanzas.demo.perfil';
const DEMO_HOY = '2026-08-31';

/**
 * Canal de avisos efímeros que va al toaster de Spartan.
 *
 * Antes era un `signal` al que se le reescribía `.set` para publicar el aviso: un parche
 * sobre la API pública de `WritableSignal` que una actualización de Angular puede romper
 * en tiempo de ejecución sin que los tipos digan nada. Aquí el canal es un objeto con su
 * propio `set()`, de la misma forma que ya usan los llamadores (`store.toast.set(...)`),
 * y sus estados viven en signals de verdad.
 */
class CanalDeAvisos {
  /** Último aviso escrito, o `''` cuando no hay. */
  readonly texto = signal('');
  /**
   * Contador de avisos emitidos. Permite reaccionar aunque el texto se repita: dos avisos
   * idénticos seguidos sí se muestran dos veces, y un lector que solo mirara `texto`
   * pensaría que la segunda escritura no ocurrió.
   */
  readonly revision = signal(0);

  set(value: string): void {
    if (value) void notifier().then((sonner) => sonner(value));
    this.texto.set(value);
    this.revision.update((contador) => contador + 1);
  }

  update(fn: (value: string) => string): void {
    this.set(fn(this.texto()));
  }
}

@Injectable({ providedIn: 'root' })
export class AppStore {
  readonly runtime = inject(RUNTIME_CONFIG);
  private provider = inject(DATA_PROVIDER);
  private injector = inject(Injector);
  /**
   * Los mensajes que salen de aquí (`throw` de validación) se pintan en el formulario tal
   * cual, así que pasan por el mismo catálogo que ya usan las plantillas: en en/fr/pt se
   * leían en español antes de este cambio.
   */
  private readonly i18n = inject(I18nService);
  readonly data = signal(this.provider.load());
  readonly users = demoUsers;
  /**
   * `photoUrl` es opcional a proposito: hoy ningun usuario demo ni la sesion de la API
   * lo traen (session.api.ts solo expone id/displayName/email), asi que queda `undefined`
   * y el sidebar sigue mostrando iniciales. El campo existe para que, en cuanto el backend
   * exponga la foto de la cuenta de Google, el avatar la use sin tocar mas que esa fuente.
   */
  readonly user = signal<((typeof demoUsers)[number] & { photoUrl?: string }) | null>(null);
  readonly remoteState = signal<'demo' | 'loading' | 'ready' | 'anonymous' | 'error'>(
    this.runtime.mode === 'demo' ? 'demo' : 'loading',
  );
  readonly remoteError = signal('');
  /**
   * Espacio activo y espacios a los que pertenece la sesion.
   *
   * El armazon escribia «Personal» a mano en tres sitios -barra lateral, barra superior
   * y ficha de perfil- mientras la sesion traia el nombre real de la organizacion, asi
   * que cualquier espacio que no se llamara asi aparecia con el nombre de otro.
   */
  readonly organization = signal<{ id: string; name: string } | null>(null);
  readonly organizations = signal<readonly { id: string; name: string }[]>([]);
  readonly remoteMovementPage = signal(1);
  readonly remoteMovementSize = signal(25);
  readonly remoteMovementTotal = signal(0);
  readonly featureFlags = signal<Record<string, boolean>>(this.data().featureFlags);
  /** Distingue «catalogo cargado y sin esta clave» de «catalogo nunca cargado». */
  readonly featureFlagsLoaded = signal(this.runtime.mode !== 'api');
  /** Tabla de invariantes publicada por la API. Vacía en modo demo, donde los datos ya traen su familia. */
  readonly kindCatalog = signal(EMPTY_KIND_CATALOG);
  readonly categories = signal<readonly ApiCategory[]>(this.runtime.mode === 'api' ? [] : DEMO_CATEGORIES);
  readonly preferences = inject(PREFERENCES);
  readonly query = signal('');
  readonly period = signal('all');
  readonly accountFilter = signal('all');
  /**
   * Último aviso. Escribirlo lo muestra en el toaster de Spartan, el mismo sistema que usa
   * AsyncActionService: antes convivían este banner propio y los toasts de sonner. Se
   * conserva la forma `toast.set(...)` para que los llamadores existentes y las pruebas
   * que lo lean sigan funcionando; `''` solo limpia el valor.
   */
  readonly toast = new CanalDeAvisos();
  readonly form = signal<{
    kind: string;
    accountId?: string;
    targetId?: string;
    movement?: Movement;
    /** Cuenta o tarjeta a editar: presente abre el formulario en modo edicion. */
    account?: Account;
    notificationId?: string;
    ownership?: Movement['ownership'];
    recurring?: boolean | string;
    recurrence?: Movement['recurrence'];
    installmentCurrent?: number;
    installmentTotal?: number;
    purchaseApr?: number;
    loanRole?: Movement['loanRole'];
    loanProduct?: Movement['loanProduct'];
    originalCurrency?: Movement['originalCurrency'];
    originalAmount?: number;
    exchangeRate?: number;
  } | null>(null);
  readonly inspector = signal<{ type: string; id: string; previous?: { type: string; id: string } } | null>(null);
  /** Dia de vuelta cuando el inspector de un movimiento se abrio desde una agenda diaria. */
  readonly calendarReturnDate = signal<string | null>(null);
  /**
   * Dia seleccionado en el calendario. El inspector de dia lo usa de resguardo.
   *
   * Arranca en hoy también en demo: la fecha escrita en el codigo (`'2026-08-18'`) era
   * «hoy» el dia que se escribio y dejo de serlo, abriendo el calendario en un dia que ya
   * no significaba nada.
   */
  readonly selectedCalendarDate = signal(todayIso());
  /** El inspector de una tarjeta muestra el extracto o la simulacion de un abono. */
  readonly cardPaymentMode = signal(false);
  readonly movements = computed(() =>
    this.data()
      .movements.filter(
        (m) =>
          (this.period() === 'all' || m.date.startsWith(this.period())) &&
          (this.accountFilter() === 'all' || m.accountId === this.accountFilter()) &&
          `${m.description} ${m.category} ${m.person ?? ''}`
            .toLocaleLowerCase()
            .includes(this.query().toLocaleLowerCase()),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
  );
  readonly income = computed(() =>
    sumBy(
      this.movements().filter((m) => m.kind === 'income' && !m.movementSubtype),
      (m) => m.amount,
    ),
  );
  readonly expense = computed(() =>
    sumBy(
      this.movements().filter((m) => m.kind === 'expense' && !m.movementSubtype),
      (m) => -m.amount,
    ),
  );
  readonly unread = computed(() => this.data().notifications.filter((n) => !n.read).length);
  readonly history = signal<{ date: string; action: string }[]>([
    // Hoy, no una fecha escrita a mano: en el historial el orden es el mensaje.
    { date: todayIso(), action: 'Información financiera inicial cargada' },
  ]);
  readonly debt = computed(() =>
    sumBy(
      this.data().accounts.filter((a) => a.type === 'credit'),
      (a) => Math.max(0, -this.balance(a)),
    ),
  );
  readonly available = computed(() =>
    sumBy(
      this.data().accounts.filter((a) => a.type !== 'credit'),
      (a) => this.balance(a),
    ),
  );
  /**
   * Moneda base del espacio de trabajo: la que trae la sesión
   * (`session.organization.baseCurrency`) y en la que el backend calcula. Es la misma
   * señal que `decimalsFor()` y `sumBy()` leen dentro de `money.ts`, así que no puede
   * haber dos opiniones distintas sobre la moneda.
   */
  readonly baseCurrency = monedaBase;
  /**
   * Catálogo de monedas de `GET /api/v1/currencies`, con los decimales que publica el
   * servidor. Lo carga `remote-bootstrap` al entrar; mientras no llega, el local.
   */
  readonly currencyCatalog = catalogoDeMonedas;
  /**
   * Formato con código de moneda explícito: `$` a secas es ambiguo en Colombia y
   * esta aplicación muestra COP, USD y EUR en la misma pantalla.
   *
   * Sin moneda explícita etiqueta en la base de la organización. Antes era `COP` de
   * compilación, de modo que una organización en USD se veía «COP» con cero decimales.
   */
  money(value: number, currency = this.baseCurrency()) {
    return formatAmount(value, currency, this.preferences().locale);
  }
  account(id: string) {
    return this.data().accounts.find((a) => a.id === id);
  }
  readonly saldosDelServidor = signal<ReadonlyMap<string, number> | null>(null);
  hoy(): string {
    return this.runtime.mode === 'demo' ? DEMO_HOY : todayIso();
  }
  balance(account: Account) {
    return this.saldosDelServidor()?.get(account.id) ?? accountBalance(account, this.data().movements);
  }
  /** Movimientos de un dia. Lo usan el calendario y el inspector de dia. */
  dayMoves(date: string | number) {
    // La rama numerica es un dia del mes: va al mes en curso, no a un mes escrito a mano.
    const iso = typeof date === 'number' ? `${todayIso().slice(0, 7)}-${String(date).padStart(2, '0')}` : date;
    return this.data().movements.filter((movement) => movement.date === iso);
  }
  /**
   * Sin tipo por defecto: abrir el formulario desde "Nuevo movimiento" no debe
   * mostrar ya los campos de gasto como si la persona los hubiera elegido. Los
   * demás llamadores (revisar una notificación, editar un movimiento existente)
   * siempre mandan su propio `kind`, así que no dependen de este valor.
   */
  open(kind = '', accountId?: string, movement?: Movement, notificationId?: string, targetId?: string) {
    this.form.set({ kind, accountId, targetId, movement, notificationId });
  }
  inspect(type: string, id: string) {
    const old = this.inspector();
    this.inspector.set({ type, id, previous: old ? { type: old.type, id: old.id } : undefined });
  }
  /**
   * Solo en modo demo: el perfil elegido vivia en memoria y un F5 devolvia a la
   * pantalla de bienvenida. En modo API manda la cookie de sesion.
   */
  rememberDemoSession(index: number): void {
    try {
      sessionStorage.setItem(DEMO_SESSION_KEY, String(index));
    } catch {
      /* almacenamiento no disponible: la sesion sigue viviendo en memoria */
    }
  }
  restoreDemoSession(): void {
    if (this.runtime.mode !== 'demo' || this.user()) return;
    try {
      // Number(null) es 0, y 0 es un indice valido: sin esta guarda, no haber
      // iniciado sesion entraba como el primer perfil.
      const stored = sessionStorage.getItem(DEMO_SESSION_KEY);
      if (stored === null) return;
      const index = Number.parseInt(stored, 10);
      if (Number.isInteger(index) && index >= 0 && index < this.users.length) {
        this.user.set(this.users[index]);
      }
    } catch {
      /* almacenamiento no disponible: se muestra la bienvenida */
    }
  }
  forgetDemoSession(): void {
    try {
      sessionStorage.removeItem(DEMO_SESSION_KEY);
    } catch {
      /* nada que limpiar */
    }
  }
  reset() {
    this.data.set(this.provider.load());
    this.query.set('');
    this.period.set('all');
    this.accountFilter.set('all');
    this.toast.set('Información inicial restaurada.');
  }
  /**
   * Anota la acción en el historial y, salvo que `notify` sea false, la avisa con un toast.
   * Las escrituras que ya pasan por AsyncActionService pasan `notify: false`: ese servicio
   * muestra su propio aviso de cargando/éxito/error y el toast de aquí salía duplicado.
   */
  log(action: string, notify = true) {
    this.history.update((h) => [{ date: new Date().toISOString().slice(0, 10), action }, ...h]);
    if (notify) this.toast.set(action);
  }
  async persistPreferences() {
    if (this.runtime.mode !== 'api') return;
    const value = this.preferences();
    // La paleta propia solo viaja si esta sesión puede definirla. Antes se enviaba
    // siempre, incluso al elegir un preset o cambiar el idioma, y la API rechaza con
    // 403 cualquier tema personalizado de quien no gobierna la organización: el efecto
    // era que un permiso de edición corriente no podía guardar nada. Un nulo aquí no
    // borra la paleta guardada; la API conserva la que ya tenía.
    const puedeTemaPropio = !!this.user()?.capabilities.includes(P.preferencias.tema.editar);
    await firstValueFrom(
      this.injector.get(FinanceApiClient).updatePreferences({
        language: value.locale,
        theme: value.theme,
        font: value.font,
        density: value.density,
        // La moneda que se guarda es la que ya está usando la organización, no un `COP`
        // fijo: el backend guarda este valor como preferencia por usuario y no cambia la
        // organización, así que escribir otra cosa solo desincronizaba la preferencia.
        baseCurrency: this.baseCurrency(),
        customThemeJson: puedeTemaPropio ? JSON.stringify(paletteOverrides(value)) : null,
      }),
    );
  }
  async save(input: {
    kind: string;
    date: string;
    description: string;
    accountId: string;
    targetId?: string;
    amount: number;
    category: string;
    person?: string;
    id?: string;
    notificationId?: string;
    ownership?: Movement['ownership'];
    recurring?: boolean | string;
    recurrence?: Movement['recurrence'];
    installmentCurrent?: number;
    installmentTotal?: number;
    purchaseApr?: number;
    loanRole?: Movement['loanRole'];
    loanProduct?: Movement['loanProduct'];
    originalCurrency?: Movement['originalCurrency'];
    originalAmount?: number;
    exchangeRate?: number;
  }) {
    if (!Number.isFinite(input.amount) || input.amount <= 0)
      throw new Error(this.i18n.t('form.movement.error.amountPositive'));
    if (!this.account(input.accountId)) throw new Error(this.i18n.t('form.movement.error.accountInvalid'));
    if (
      (input.kind === 'payment' || input.kind === 'transfer' || input.kind === 'advance') &&
      (!input.targetId || input.targetId === input.accountId || !this.account(input.targetId))
    )
      throw new Error(this.i18n.t('form.movement.error.targetDifferent'));
    if (this.runtime.mode === 'api') {
      if (input.id) {
        const category = this.categories().find((item) => item.name === input.category);
        const updated = await firstValueFrom(
          this.injector.get(FinanceApiClient).reclassifyMovement(input.id, {
            category: category?.id ?? null,
            description: input.description || null,
          }),
        );
        this.data.update((data) => ({
          ...data,
          movements: data.movements.map((item) =>
            item.id === input.id
              ? { ...item, description: updated.description ?? input.description, category: input.category }
              : item,
          ),
        }));
        this.form.set(null);
        this.log('Movimiento reclasificado en la API', false);
        return;
      }
      const account = this.account(input.accountId);
      if (!account) throw new Error(this.i18n.t('form.movement.error.accountInvalid'));
      if (input.kind === 'transfer' || input.kind === 'advance' || input.kind === 'payment') {
        const amount = { amount: String(input.amount), currency: account.currency };
        const idempotencyKey = crypto.randomUUID();
        const client = this.injector.get(FinanceApiClient);
        const operation = await firstValueFrom(
          input.kind === 'payment'
            ? client.createCardPayment({
                date: input.date,
                amount,
                account: input.accountId,
                card: input.targetId!,
                description: input.description,
                idempotencyKey,
              })
            : input.kind === 'advance'
              ? client.createCashAdvance({
                  date: input.date,
                  amount,
                  card: input.accountId,
                  account: input.targetId!,
                  description: input.description,
                  idempotencyKey,
                })
              : client.createTransfer({
                  date: input.date,
                  amount,
                  sourceAccount: input.accountId,
                  destinationAccount: input.targetId!,
                  description: input.description,
                  idempotencyKey,
                }),
        );
        // Transferencia y avance no son su propia clase de movimiento: la pata que sale
        // es un gasto y la que entra un ingreso, con `movementSubtype` como única marca
        // de que el dinero solo se movió entre cuentas — ver el comentario en Movement.
        const movementSubtype =
          input.kind === 'transfer' ? 'transfer' : input.kind === 'advance' ? 'advance' : undefined;
        const created = operation.legs.map<Movement>((leg) => {
          const legAmount = parseMoney(leg.amount.base) * signOf(leg.flow, leg.effect);
          return {
            id: leg.id,
            date: leg.date,
            description: leg.description ?? input.description,
            accountId: leg.links['account'] ?? leg.links['card'] ?? '',
            category: 'Transferencias',
            kind: input.kind === 'payment' ? 'payment' : legAmount < 0 ? 'expense' : 'income',
            movementSubtype,
            amount: legAmount,
            status: 'confirmed',
          };
        });
        this.data.update((data) => ({ ...data, movements: [...created, ...data.movements] }));
        this.form.set(null);
        this.log(
          input.kind === 'payment'
            ? 'Abono registrado en la API'
            : input.kind === 'advance'
              ? 'Avance registrado en la API'
              : 'Transferencia registrada en la API',
          false,
        );
        return;
      }
      const isIncome = input.kind === 'income';
      const isCard = account.type === 'credit';
      // El formulario guarda categoría y persona por nombre —es lo que ve y elige
      // quien lo usa—, pero el backend solo acepta enlaces por id. Sin resolverlos
      // aquí, el POST se enviaba sin `category` ni `counterparty`: la copia
      // optimista sí los mostraba y, al recargar, el movimiento reaparecía «Sin
      // categoría» y sin persona, sin forma de recuperarlo desde la interfaz.
      const categoria = this.categories().find((item) => item.name === input.category);
      const persona = this.data().people.find((item) => item.name === input.person);
      const created = await firstValueFrom(
        this.injector.get(FinanceApiClient).createMovement({
          date: input.date,
          kind: isIncome ? MovementKind.income : isCard ? MovementKind.cardPurchase : MovementKind.expense,
          effect: isIncome ? EconomicEffect.income : EconomicEffect.expense,
          flow: isIncome ? CashFlow.inflow : CashFlow.outflow,
          amount: {
            amount: String(input.originalCurrency === 'USD' ? input.originalAmount : input.amount),
            currency: input.originalCurrency ?? account.currency,
          },
          links: {
            ...(isCard ? { card: input.accountId } : { account: input.accountId }),
            ...(categoria ? { category: categoria.id } : {}),
            ...(persona ? { counterparty: persona.id } : {}),
          },
          rate: input.originalCurrency === 'USD' ? String(input.exchangeRate) : undefined,
          rateAsOf: input.originalCurrency === 'USD' ? input.date : undefined,
          description: input.description,
          idempotencyKey: crypto.randomUUID(),
          purchaseApr: isCard ? input.purchaseApr : undefined,
        }),
      );
      const sign = signOf(created.flow, created.effect);
      const movement: Movement = {
        id: created.id,
        date: created.date,
        description: created.description ?? input.description,
        accountId: input.accountId,
        // Lo que vale es lo que guardó el servidor: su nombre de categoría y de
        // persona es el que sobrevive a la recarga, y el enlace de contraparte es
        // lo que decide si el movimiento es un préstamo («prestado») o propio.
        category: created.linkNames['category']?.name ?? input.category,
        kind: input.kind as Movement['kind'],
        amount: parseMoney(created.amount.base) * sign,
        status: 'confirmed',
        person: created.linkNames['counterparty']?.name ?? input.person,
        ownership: created.links['counterparty'] ? 'loaned' : 'own',
        recurring: input.recurring === true || input.recurring === 'true',
        loanRole: input.loanRole,
        loanProduct: input.loanProduct,
        purchaseApr: created.purchaseApr ?? undefined,
      };
      this.data.update((data) => ({ ...data, movements: [movement, ...data.movements] }));
      this.form.set(null);
      this.log('Movimiento registrado en la API', false);
      return;
    }
    const id = input.id ?? crypto.randomUUID();
    // `input.kind` es la operación pedida (qué botón/tipo eligió la persona), no
    // necesariamente la clase que se guarda: transferencia y avance no son su propia
    // clase de movimiento, la pata que sale es un gasto y la que entra un ingreso —
    // `movementSubtype` es la única marca que los distingue de una compra o un sueldo
    // real, y lo que excluyen los KPI y el filtro de Operación. `payment` (abono de
    // tarjeta) sí sigue siendo su propia clase, sin tocar.
    const isDualLeg = input.kind === 'payment' || input.kind === 'transfer' || input.kind === 'advance';
    const movementSubtype: Movement['movementSubtype'] =
      input.kind === 'transfer' ? 'transfer' : input.kind === 'advance' ? 'advance' : undefined;
    const kind: Movement['kind'] =
      input.kind === 'payment' ? 'payment' : input.kind === 'income' ? 'income' : 'expense';
    const movement: Movement = {
      id,
      date: input.date,
      description: input.description,
      accountId: input.accountId,
      category: input.category,
      kind,
      movementSubtype,
      amount: kind === 'income' ? input.amount : -input.amount,
      status: 'confirmed',
      person: input.person,
      ownership: input.person ? 'loaned' : (input.ownership ?? 'own'),
      recurring: input.recurring === true || input.recurring === 'true',
      recurrence: input.recurring === true || input.recurring === 'true' ? input.recurrence : undefined,
      installmentCurrent:
        input.installmentTotal && input.installmentTotal > 1 ? Number(input.installmentCurrent || 1) : undefined,
      installmentTotal:
        input.installmentTotal && input.installmentTotal > 1 ? Number(input.installmentTotal) : undefined,
      loanRole: input.loanRole,
      loanProduct: input.loanProduct,
      originalCurrency: input.originalCurrency,
      originalAmount: input.originalCurrency === 'USD' ? Number(input.originalAmount) : undefined,
      exchangeRate: input.originalCurrency === 'USD' ? Number(input.exchangeRate) : undefined,
      // Solo aplica a una compra de tarjeta: el resto de clases no causa interes por
      // tasa anual, asi que un valor aqui no significaria nada (misma regla del backend).
      purchaseApr:
        kind === 'expense' && this.account(input.accountId)?.type === 'credit' ? input.purchaseApr : undefined,
    };
    this.data.update((d) => ({
      ...d,
      movements: [
        ...d.movements.filter((m) => m.id !== id),
        movement,
        ...(isDualLeg
          ? [
              {
                ...movement,
                id: id + '-to',
                accountId: input.targetId!,
                amount: input.amount,
                kind: (input.kind === 'payment' ? 'payment' : 'income') as Movement['kind'],
              },
            ]
          : []),
      ],
      notifications: d.notifications.map((n) => (n.id === input.notificationId ? { ...n, read: true } : n)),
    }));
    this.form.set(null);
    this.log(input.id ? 'Movimiento corregido; acción registrada' : 'Movimiento registrado', false);
  }
  async createAccount(
    name: string,
    type: Account['type'],
    opening: number,
    currency = 'COP',
    exchangeRate?: number,
    credit?: { limit: number; cutDay: number; dueDay: number },
  ) {
    if (this.runtime.mode === 'api') {
      if (opening < 0) throw new Error(this.i18n.t('form.account.error.openingNegative'));
      const client = this.injector.get(FinanceApiClient);
      if (type === 'credit') {
        if (!credit || credit.limit <= 0) throw new Error(this.i18n.t('form.account.error.creditLimit'));
        const created = await firstValueFrom(
          client.createCard({
            name,
            currency,
            creditLimit: { amount: String(credit.limit), currency },
            cycle: { statementDay: credit.cutDay, paymentDueDay: credit.dueDay },
            terms: {
              purchaseApr: { rate: '0' },
              cashAdvanceApr: { rate: '0' },
              internationalPurchaseApr: { rate: '0' },
              deferredDefaultApr: { rate: '0' },
              minimumPaymentRate: { rate: '0' },
              minimumPaymentFloor: null,
              gracePeriodDays: 0,
            },
            lastFour: '0000',
          }),
        );
        this.data.update((data) => ({
          ...data,
          accounts: [
            ...data.accounts,
            {
              id: created.id,
              name: created.name,
              type: 'credit',
              currency: created.currency,
              openingBalance: 0,
              limit: parseMoney(created.creditLimit),
              lastFour: created.lastFour ?? undefined,
              cutDay: created.cycle.statementDay,
              dueDay: created.cycle.paymentDueDay,
            },
          ],
        }));
        this.form.set(null);
        this.log('Tarjeta creada en la API', false);
        return;
      }
      // El `kind` del contrato sale del tipo de vista. Antes eran dos números escritos a
      // mano (`cash ? 1 : 3`), de modo que una cuenta corriente, una billetera u otra se
      // abrian como ahorro sin que nadie lo pidiera.
      const accountRequest = { name, kind: viewTypeToAccountKind(type), currency, lastFour: '0000' };
      const openingResult =
        opening === 0
          ? null
          : await firstValueFrom(
              client.createAccountWithOpening({
                account: accountRequest,
                openingBalance: { amount: String(Math.abs(opening)), currency },
                date: new Date().toISOString().slice(0, 10),
                rate: currency === 'USD' ? String(exchangeRate) : null,
                rateAsOf: currency === 'USD' ? new Date().toISOString().slice(0, 10) : null,
                idempotencyKey: crypto.randomUUID(),
              }),
            );
      const created = openingResult?.account ?? (await firstValueFrom(client.createAccount(accountRequest)));
      const account: Account = {
        id: created.id,
        name: created.name,
        type,
        currency: created.currency,
        openingBalance: 0,
        lastFour: created.lastFour ?? undefined,
      };
      this.data.update((data) => ({ ...data, accounts: [...data.accounts, account] }));
      if (openingResult) {
        const movement = openingResult.openingMovement;
        this.data.update((data) => ({
          ...data,
          movements: [
            {
              id: movement.id,
              date: movement.date,
              description: movement.description ?? `Saldo de apertura · ${name}`,
              accountId: created.id,
              category: 'Apertura',
              kind: 'income',
              amount: parseMoney(movement.amount.base),
              status: 'confirmed',
            },
            ...data.movements,
          ],
        }));
      }
      this.form.set(null);
      this.log('Cuenta creada en la API', false);
      return;
    }
    const id = crypto.randomUUID();
    const account: Account = {
      id,
      name,
      type,
      currency,
      ...(currency === 'USD' ? { exchangeRate } : {}),
      openingBalance: 0,
      lastFour: '0000',
      color: '#087f68',
      ...(type === 'credit'
        ? { limit: credit?.limit ?? 5000000, cutDay: credit?.cutDay ?? 20, dueDay: credit?.dueDay ?? 5 }
        : {}),
    };
    this.data.update((d) => ({
      ...d,
      accounts: [...d.accounts, account],
      movements:
        opening === 0
          ? d.movements
          : [
              ...d.movements,
              {
                id: crypto.randomUUID(),
                // Hoy, como hace la rama remota con `date: new Date()...`: el movimiento
                // de apertura es un hecho de ahora, no de la ultima fecha escrita en el codigo.
                date: todayIso(),
                description: 'Saldo de apertura · ' + name,
                accountId: id,
                category: 'Apertura',
                kind: opening > 0 ? 'income' : 'expense',
                amount: opening,
                status: 'confirmed',
              },
            ],
    }));
    this.form.set(null);
    this.log('Cuenta creada', false);
  }
  async createCategory(name: string, color: string, icon: string, kind: 'income' | 'expense' = 'expense') {
    // El backend distingue ingreso de gasto porque no existe categoria neutra: un
    // traslado categorizado apareceria en los reportes ademas del gasto real. El
    // formulario de movimiento filtra por este mismo valor, asi que una categoria sin
    // el tipo correcto queda invisible para el tipo de movimiento al que en realidad
    // pertenece.
    const type = kind === 'income' ? 1 : 2;
    if (this.runtime.mode === 'api') {
      const created = await firstValueFrom(
        this.injector.get(FinanceApiClient).createCategory({ name, type, color, icon }),
      );
      this.categories.update((items) => [...items, created]);
    } else {
      this.categories.update((items) => [
        ...items,
        {
          id: `local-${Date.now()}`,
          name,
          type,
          color,
          icon,
          parent: null,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    this.form.set(null);
    this.log(`Categoría ${name} creada`);
  }
  async createPerson(
    name: string,
    email?: string,
    relationship: import('./demo-data').Person['relationship'] = 'Otro',
  ) {
    if (this.runtime.mode === 'api') {
      const created = await firstValueFrom(
        this.injector.get(FinanceApiClient).createPerson({ displayName: name, email: email || null }),
      );
      this.data.update((data) => ({
        ...data,
        people: [
          ...data.people,
          { id: created.id, name: created.displayName, owed: 0, owing: 0, relationship, email: email || undefined },
        ],
      }));
    } else {
      this.data.update((data) => ({
        ...data,
        people: [...data.people, { id: crypto.randomUUID(), name, owed: 0, owing: 0, relationship, email }],
      }));
    }
    this.form.set(null);
    this.log(`Persona ${name} creada`);
  }
  async updateAccount(
    account: Account,
    changes: { name: string; lastFour?: string; credit?: { limit: number; cutDay: number; dueDay: number } },
  ) {
    const name = changes.name.trim();
    if (!name) throw new Error(this.i18n.t('form.management.error.nameRequired'));
    const lastFour = changes.lastFour?.trim() || undefined;
    if (lastFour && !/^\d{4}$/.test(lastFour)) throw new Error(this.i18n.t('form.account.error.lastFour'));
    const credito = account.type === 'credit' ? changes.credit : undefined;
    if (account.type === 'credit' && (!credito || credito.limit <= 0))
      throw new Error(this.i18n.t('form.account.error.creditLimit'));
    if (this.runtime.mode === 'api') {
      const client = this.injector.get(FinanceApiClient);
      if (credito) {
        const actual = (await firstValueFrom(client.cards())).find((card) => card.id === account.id);
        if (!actual) throw new Error(this.i18n.t('form.error.notFound'));
        await firstValueFrom(
          client.updateCard(account.id, {
            name,
            creditLimit: { amount: String(credito.limit), currency: actual.currency },
            cycle: { statementDay: credito.cutDay, paymentDueDay: credito.dueDay },
            terms: actual.terms,
            issuer: actual.issuer,
            lastFour: lastFour ?? null,
            isActive: actual.isActive,
          }),
        );
      } else {
        const actual = (await firstValueFrom(client.accounts())).find((item) => item.id === account.id);
        if (!actual) throw new Error(this.i18n.t('form.error.notFound'));
        await firstValueFrom(
          client.updateAccount(account.id, {
            name,
            institution: actual.institution,
            lastFour: lastFour ?? null,
            isDefault: actual.isDefault,
            isActive: actual.isActive,
          }),
        );
      }
    }
    const actualizada: Account = {
      ...account,
      name,
      lastFour,
      ...(credito ? { limit: credito.limit, cutDay: credito.cutDay, dueDay: credito.dueDay } : {}),
    };
    this.data.update((data) => ({
      ...data,
      accounts: data.accounts.map((item) => (item.id === account.id ? actualizada : item)),
    }));
    this.form.set(null);
    this.log(`${account.type === 'credit' ? 'Tarjeta' : 'Cuenta'} ${name} actualizada`, false);
  }
  async updateCategory(id: string, changes: { name: string; color: string; icon: string }) {
    const name = changes.name.trim();
    if (!name) throw new Error(this.i18n.t('form.management.error.nameRequired'));
    const actual = this.categories().find((category) => category.id === id);
    if (!actual) throw new Error(this.i18n.t('form.error.notFound'));
    const guardada =
      this.runtime.mode === 'api'
        ? await firstValueFrom(
            this.injector.get(FinanceApiClient).updateCategory(id, {
              name,
              color: changes.color,
              icon: changes.icon,
              parent: actual.parent,
              isActive: actual.isActive,
            }),
          )
        : { ...actual, name, color: changes.color, icon: changes.icon };
    this.categories.update((items) => items.map((item) => (item.id === id ? guardada : item)));
    if (actual.name !== guardada.name)
      this.data.update((data) => ({
        ...data,
        movements: data.movements.map((movement) =>
          movement.category === actual.name ? { ...movement, category: guardada.name } : movement,
        ),
      }));
    this.form.set(null);
    this.log(`Categoría ${guardada.name} actualizada`);
  }
  async updatePerson(
    id: string,
    changes: { name: string; email?: string; relationship?: import('./demo-data').Person['relationship'] },
  ) {
    const name = changes.name.trim();
    if (!name) throw new Error(this.i18n.t('form.management.error.nameRequired'));
    const actual = this.data().people.find((person) => person.id === id);
    if (!actual) throw new Error(this.i18n.t('form.error.notFound'));
    const email = changes.email?.trim() || undefined;
    if (this.runtime.mode === 'api') {
      const client = this.injector.get(FinanceApiClient);
      const remota = (await firstValueFrom(client.people())).find((person) => person.id === id);
      if (!remota) throw new Error(this.i18n.t('form.error.notFound'));
      await firstValueFrom(
        client.updatePerson(id, {
          displayName: name,
          alias: remota.alias,
          email: email ?? null,
          phone: remota.phone,
          notes: remota.notes,
          isActive: remota.isActive,
        }),
      );
    }
    this.data.update((data) => ({
      ...data,
      people: data.people.map((person) =>
        person.id === id
          ? { ...person, name, email, relationship: changes.relationship ?? person.relationship }
          : person,
      ),
      movements: data.movements.map((movement) =>
        movement.person === actual.name ? { ...movement, person: name } : movement,
      ),
    }));
    this.form.set(null);
    this.log(`Persona ${name} actualizada`);
  }
  async updateInvestment(id: string, changes: { name: string; instrumentType: string }) {
    const name = changes.name.trim();
    if (!name) throw new Error(this.i18n.t('form.management.error.nameRequired'));
    if (!this.data().investments.some((investment) => investment.id === id))
      throw new Error(this.i18n.t('form.error.notFound'));
    if (this.runtime.mode === 'api') {
      const client = this.injector.get(FinanceApiClient);
      const remota = (await firstValueFrom(client.investments())).find((investment) => investment.id === id);
      if (!remota) throw new Error(this.i18n.t('form.error.notFound'));
      await firstValueFrom(
        client.updateInvestment(id, {
          name,
          instrumentType: changes.instrumentType,
          risk: remota.risk ?? 2,
          symbol: remota.symbol ?? null,
          isActive: remota.isActive,
        }),
      );
    }
    this.data.update((data) => ({
      ...data,
      investments: data.investments.map((investment) =>
        investment.id === id ? { ...investment, name, type: changes.instrumentType } : investment,
      ),
    }));
    this.form.set(null);
    this.log(`Inversión ${name} actualizada`);
  }
  async createInvestment(name: string, instrumentType: string, currency: string) {
    if (this.runtime.mode === 'api') {
      const created = await firstValueFrom(
        this.injector.get(FinanceApiClient).createInvestment({ name, instrumentType, currency, risk: 2 }),
      );
      this.data.update((data) => ({
        ...data,
        investments: [
          ...data.investments,
          {
            id: created.id,
            name: created.name,
            type: created.instrumentType,
            cost: parseMoney(created.costBasis),
            value: parseMoney(created.marketValue ?? created.costBasis),
            institution: 'Sin especificar',
            currency,
            units: 0,
            risk: 'Medio',
            liquidity: 'Programada',
          },
        ],
      }));
    } else {
      this.data.update((data) => ({
        ...data,
        investments: [
          ...data.investments,
          {
            id: crypto.randomUUID(),
            name,
            type: instrumentType,
            cost: 0,
            value: 0,
            institution: 'Sin especificar',
            currency,
            units: 0,
            risk: 'Medio',
            liquidity: 'Programada',
          },
        ],
      }));
    }
    this.form.set(null);
    this.log(`Inversión ${name} creada`);
  }
  async createRecurrence(name: string, amount: number, accountId: string, frequency: number, start: string) {
    if (this.runtime.mode === 'api') {
      const account = this.account(accountId);
      if (!account) throw new Error(this.i18n.t('form.recurrence.error.accountInvalid'));
      await firstValueFrom(
        this.injector.get(FinanceApiClient).createRecurrence({
          name,
          movementTemplate: account.type === 'credit' ? 20 : 2,
          amount: { amount: String(amount), currency: account.currency },
          target: account.type === 'credit' ? { card: accountId } : { account: accountId },
          schedule: {
            frequency,
            interval: 1,
            start,
            end: null,
            dayOfMonth: frequency === 3 ? Number(start.slice(-2)) : null,
            dayOfWeek: null,
          },
        }),
      );
    }
    this.form.set(null);
    this.log(`Recurrencia ${name} creada`);
  }
}
