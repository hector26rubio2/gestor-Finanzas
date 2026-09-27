import { todayIso } from '@core/utils/dates';
import { computed, inject, Injectable, InjectionToken, Injector, signal } from '@angular/core';
import { notifier } from '@core/notifications/notifier';
import { Account, accountBalance, createEmptyData, ViewData, SessionUser, Movement, PersonKind } from './view-model';
import { ApiCategory } from '@core/api/api-client';
import {
  baseCurrency as monedaBase,
  currencyCatalog as catalogoDeMonedas,
  formatAmount,
  sumBy,
} from '@core/utils/money';
import { I18nService } from '@core/i18n';
import { EMPTY_KIND_CATALOG } from '@core/utils/movement-kinds';
import { RUNTIME_CONFIG } from '@core/session/runtime';
import { PREFERENCES } from './theme';

export { applyTheme, PREFERENCES } from './theme';
export type { Preferences } from './theme';
export { navigation } from './navigation';

export interface DataProvider {
  load(): ViewData;
}
export const DATA_PROVIDER = new InjectionToken<DataProvider>('DataProvider', {
  providedIn: 'root',
  factory: () => ({ load: createEmptyData }),
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
        if (!store.featureFlagsLoaded()) return false;
        if (key === 'admin') return true;
        return store.featureFlags()[key] === true;
      },
    };
  },
});

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

export interface CondicionesDeTarjeta {
  limit: number;
  cutDay: number;
  dueDay: number;
  monthlyRate?: number;
  issuerId?: string;
  paymentPriority?: readonly number[];
  foreignPaymentPriority?: readonly number[];
  monthlyFee?: number;
  dualCurrency?: boolean;
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
  /**
   * `photoUrl` es opcional a proposito: hoy ningun usuario demo ni la sesion de la API
   * lo traen (session.api.ts solo expone id/displayName/email), asi que queda `undefined`
   * y el sidebar sigue mostrando iniciales. El campo existe para que, en cuanto el backend
   * exponga la foto de la cuenta de Google, el avatar la use sin tocar mas que esa fuente.
   */
  readonly user = signal<SessionUser | null>(null);
  readonly remoteState = signal<'loading' | 'ready' | 'anonymous' | 'error'>('loading');
  readonly remoteError = signal('');
  readonly disenoDelServidor = signal<{ readonly json: string | null } | null>(null);
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
  readonly featureFlagsLoaded = signal(false);
  /** Tabla de invariantes publicada por la API. Vacía en modo demo, donde los datos ya traen su familia. */
  readonly kindCatalog = signal(EMPTY_KIND_CATALOG);
  readonly categories = signal<readonly ApiCategory[]>([]);
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
    personKind?: PersonKind;
    operationType?: string;
    accountType?: Account['type'];
    notificationId?: string;
    ownership?: Movement['ownership'];
    recurring?: boolean | string;
    recurrence?: Movement['recurrence'];
    installmentCurrent?: number;
    installmentTotal?: number;
    purchaseApr?: number;
    cardBucket?: number;
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
    return todayIso();
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
}
