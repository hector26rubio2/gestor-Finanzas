import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ReportsTabComponent } from '../features/reports/reports-tab';
import { PeopleTabComponent } from '../features/people/people-tab';
import { PortfolioTabComponent } from '../features/portfolio/portfolio-tab';
import { PlanningTabComponent } from '../features/planning/planning-tab';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AccountFormComponent, ManagementFormComponent } from '../forms';
import { toCsv, downloadCsv } from '../core/csv';
import { IconComponent } from '../ui/icon';
import { SinAccesoComponent } from '../ui/sin-acceso';
import { P } from '../core/permissions';
import { RemoteBootstrap } from '../core/remote-bootstrap';
import { sincronizarConLaUrl } from '../core/url-state';
import { applyTheme, CAPABILITIES, DemoStore } from '../core/store';
import { DataTableComponent, KpiComponent, OverlayComponent } from '../ui/ui';
import { UiOption, UiSelectComponent } from '../ui/select';
import {
  ApiAdminRole,
  ApiAuditEvent,
  ApiOrganizationMember,
  ApiMovement,
  ApiProjectedOccurrence,
  ApiRecurrence,
  FinanceApiClient,
} from '../core/api-client';
import { firstValueFrom } from 'rxjs';
import { DemoAuditEvent } from '../core/demo-data';
import { formatReturnRate, parseMoney } from '../core/money';
import { signOf } from '../core/movement-kinds';

/*
 * Sin rotulo sobre el titulo. Un «LIBRO CENTRAL» en versales encima de «Movimientos» no
 * dice nada que el titulo no diga ya, y es el adorno mas repetido de las interfaces
 * generadas. La estructura tiene que codificar informacion, no decorarla.
 */
const labels: Record<string, { title: string; description: string }> = {
  movements: {
    title: 'Movimientos',
    description: 'Todos los efectos económicos, en un único lugar.',
  },
  calendar: {
    title: 'Calendario',
    description: 'Consulta operaciones y compromisos sin deformar el calendario.',
  },
  accounts: {
    title: 'Cuentas y tarjetas',
    description: 'Explora cuentas, tarjetas y sus movimientos relacionados.',
  },
  people: {
    title: 'Personas y deudas',
    description: 'Lo que debes y lo que te deben, sin compensaciones engañosas.',
  },
  portfolio: {
    title: 'Patrimonio e inversiones',
    description: 'Activos, pasivos y posiciones vinculadas a movimientos.',
  },
  planning: {
    title: 'Planificación',
    description: 'Compara alternativas sin modificar movimientos reales.',
  },
  reports: {
    title: 'Reportes',
    description: 'Entiende qué ocurrió y abre los movimientos que explican cada cifra.',
  },
  notifications: {
    title: 'Notificaciones',
    description: 'Revisa propuestas antes de convertirlas en movimientos.',
  },
  admin: {
    title: 'Administración',
    description: 'Miembros, capacidades y trazabilidad de la organización.',
  },
  settings: {
    title: 'Preferencias',
    description: 'Temas, tipografía, idioma y preferencias personales.',
  },
};

/** Marca de dato ausente. Un campo que la API no publica se comunica, no se rellena. */
const SIN_DATO = '—';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DataTableComponent,
    KpiComponent,
    OverlayComponent,
    AccountFormComponent,
    ManagementFormComponent,
    SinAccesoComponent,
    IconComponent,
    UiSelectComponent,
    ReportsTabComponent,
    PeopleTabComponent,
    PortfolioTabComponent,
    PlanningTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace.html',
  styleUrl: './workspace.css',
})
export class WorkspaceComponent implements AfterViewInit {
  readonly Math = Math;
  readonly store = inject(DemoStore);
  private readonly capabilities = inject(CAPABILITIES);
  readonly P = P;
  /** Reactivo: el sondeo de sesion cambia permisos y la interfaz debe seguirlo. */
  readonly canCustomize = computed(() => this.capabilities.allows(P.preferencias.tema.editar));
  /** Comprobacion puntual desde plantilla. */
  readonly miembros = signal<readonly ApiOrganizationMember[]>([]);
  readonly rolesDisponibles = signal<readonly ApiAdminRole[]>([]);
  readonly roleOptions = computed<readonly UiOption[]>(() =>
    this.rolesDisponibles().map((role) => ({ value: role.id, label: role.name })),
  );
  readonly errorDeInvitacion = signal('');
  correoInvitado = '';
  nombreInvitado = '';
  rolInvitado = '';

  /**
   * Suma a alguien al espacio.
   *
   * No se manda correo: la invitacion deja la membresia pendiente y la persona entra la
   * primera vez que inicia sesion con esa direccion. Montar envio de correo es otro
   * problema —servidor, dominio verificado, rebotes— y fingirlo seria peor que no tenerlo.
   */
  async invitar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.errorDeInvitacion.set('');
    const email = this.correoInvitado.trim();
    if (!email || !this.rolInvitado) return;
    try {
      const miembro = await firstValueFrom(
        this.api.inviteOrganizationMember({
          email,
          displayName: this.nombreInvitado.trim() || undefined,
          roleIds: [this.rolInvitado],
        }),
      );
      this.miembros.update((xs) => [...xs, miembro]);
      this.correoInvitado = '';
      this.nombreInvitado = '';
      this.store.toast.set(`${miembro.email} entrará la próxima vez que inicie sesión.`);
    } catch (error) {
      this.errorDeInvitacion.set(error instanceof Error ? error.message : 'No fue posible invitar.');
    }
  }

  private async cargarMiembros(): Promise<void> {
    if (this.store.runtime.mode !== 'api' || !this.can(P.organizacion.miembros.listar)) return;
    try {
      const [gente, roles] = await Promise.all([
        firstValueFrom(this.api.organizationMembers()),
        this.can(P.administracion.roles.listar) ? firstValueFrom(this.api.adminRoles()) : Promise.resolve([]),
      ]);
      this.miembros.set(gente);
      this.rolesDisponibles.set(roles);
      if (!this.rolInvitado && roles.length) this.rolInvitado = roles[0].id;
    } catch {
      /* sin lista: la seccion queda vacia y el resto de Preferencias sigue */
    }
  }

  /**
   * Vistas cuyo contenido son bloques sueltos, cada uno con su permiso.
   *
   * Las demas se sostienen solas: llegar a Movimientos exige `movimientos.ver`, y ese
   * codigo ya trae la tabla. Estas dos no tienen nada equivalente —Reportes es un
   * conjunto de bloques y Planificacion un conjunto de simuladores—, asi que sin ninguno
   * concedido quedan en blanco.
   *
   * Antes hacia falta ademas un `X.listar` en las siete, y concederlo se olvidaba: la
   * entrada aparecia en el menu lateral y dentro no habia nada, sin decir por que.
   */
  private readonly bloquesPorVista: Readonly<Record<string, readonly string[]>> = {
    reports: [
      P.reportes.comparativo.ver,
      P.reportes.categorias.ver,
      P.reportes.tendencia.ver,
      P.reportes.deuda.ver,
      P.reportes.patrimonio.ver,
      P.reportes.hallazgos.ver,
      P.reportes.exportar,
    ],
    planning: [
      P.planificacion.deudas.ver,
      P.planificacion.compras.ver,
      P.planificacion.vacaciones.ver,
      P.planificacion.inversiones.ver,
    ],
  };

  /** La vista activa no tiene ni uno de sus bloques concedido. */
  readonly sinNingunBloque = computed(() => {
    const bloques = this.bloquesPorVista[this.page()];
    return !!bloques && !bloques.some((codigo) => this.can(codigo));
  });

  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private readonly arranque = inject(RemoteBootstrap);
  private api = inject(FinanceApiClient);
  private movementRequest = 0;
  readonly projectedOccurrences = signal<readonly ApiProjectedOccurrence[]>([]);
  readonly auditEvents = signal<readonly ApiAuditEvent[]>([]);
  readonly auditActor = signal('all');
  readonly auditModule = signal('all');
  readonly demoAuditEvents = computed<readonly DemoAuditEvent[]>(() => this.store.data().auditEvents);
  readonly normalizedAuditEvents = computed<readonly DemoAuditEvent[]>(() =>
    this.store.runtime.mode === 'demo'
      ? this.demoAuditEvents()
      : this.auditEvents().map((event) => ({
          id: event.id,
          createdAt: event.createdAt,
          actor: 'Usuario autenticado',
          action: event.action,
          module: event.entityType,
          entityType: event.entityType,
          entityId: event.entityId ?? '',
          result: 'Exitoso',
        })),
  );
  readonly auditActors = computed(() => [...new Set(this.normalizedAuditEvents().map((event) => event.actor))]);
  readonly auditModules = computed(() => [...new Set(this.normalizedAuditEvents().map((event) => event.module))]);
  readonly visibleAuditEvents = computed(() =>
    this.normalizedAuditEvents().filter(
      (event) =>
        (this.auditActor() === 'all' || event.actor === this.auditActor()) &&
        (this.auditModule() === 'all' || event.module === this.auditModule()),
    ),
  );
  readonly recurrences = signal<readonly ApiRecurrence[]>([]);
  readonly featureFlagRows = computed(() =>
    Object.entries(this.store.featureFlags()).map(([key, enabled]) => ({ key, enabled })),
  );
  readonly page = computed(() => this.route.snapshot.url[0]?.path ?? 'movements');
  readonly meta = computed(() => labels[this.page()] ?? labels['movements']);
  readonly compactCards = signal(false);
  readonly movementAccountType = signal<'all' | 'savings' | 'credit' | 'cash'>('all');
  private readonly urlDeMovimientos = sincronizarConLaUrl('instrumento', this.movementAccountType, 'all', (v) =>
    ['all', 'savings', 'credit', 'cash'].includes(v),
  );
  readonly movementCategory = signal('all');
  readonly movementOperation = signal('all');
  readonly movementCategories = computed(() => [...new Set(this.store.data().movements.map((m) => m.category))].sort());
  readonly periodOptions: readonly UiOption[] = [
    { value: 'all', label: 'Últimos 12 meses' },
    { value: '2026-08', label: 'Agosto 2026' },
    { value: '2026-07', label: 'Julio 2026' },
    { value: '2026-06', label: 'Junio 2026' },
    { value: '2026-05', label: 'Mayo 2026' },
  ];
  readonly movementAccountOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: 'Todas las cuentas' },
    ...this.store.data().accounts.map((account) => ({ value: account.id, label: account.name })),
  ]);
  readonly accountTypeOptions: readonly UiOption[] = [
    { value: 'all', label: 'Todas' },
    { value: 'savings', label: 'Ahorros' },
    { value: 'credit', label: 'Crédito' },
    { value: 'cash', label: 'Efectivo' },
  ];
  readonly movementCategoryOptions = computed<readonly UiOption[]>(() => [
    { value: 'all', label: 'Todas' },
    ...this.movementCategories().map((category) => ({ value: category, label: category })),
  ]);
  readonly movementOperationOptions: readonly UiOption[] = [
    { value: 'all', label: 'Todas' },
    { value: 'income', label: 'Ingresos' },
    { value: 'expense', label: 'Gastos / compras' },
    { value: 'transfer', label: 'Transferencias' },
    { value: 'loan', label: 'Préstamos y créditos' },
    { value: 'recurring', label: 'Recurrentes' },
  ];
  readonly accountQuery = signal('');
  readonly accountType = signal<'all' | 'savings' | 'credit' | 'cash'>('all');
  private readonly urlDeCuentas = sincronizarConLaUrl('tipo', this.accountType, 'all', (v) =>
    ['all', 'savings', 'credit', 'cash'].includes(v),
  );
  readonly filteredAccounts = computed(() => {
    const query = this.accountQuery().trim().toLocaleLowerCase('es');
    const type = this.accountType();
    return this.store
      .data()
      .accounts.filter(
        (account) =>
          (type === 'all' || account.type === type) &&
          (!query ||
            account.name.toLocaleLowerCase('es').includes(query) ||
            (account.lastFour ?? '').toLocaleLowerCase('es').includes(query)),
      );
  });
  readonly accountPage = signal(0);
  readonly accountPageSize = 6;
  readonly accountPageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredAccounts().length / this.accountPageSize)),
  );
  readonly visibleAccounts = computed(() =>
    this.filteredAccounts().slice(
      this.accountPage() * this.accountPageSize,
      (this.accountPage() + 1) * this.accountPageSize,
    ),
  );
  readonly selectedAccountFilter = signal('all');
  readonly accountMovementRows = computed(() =>
    this.movementRows().filter(
      (row) => this.selectedAccountFilter() === 'all' || row['raw']?.accountId === this.selectedAccountFilter(),
    ),
  );
  readonly calendarViews = [
    { value: 'day', label: 'Día' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
    { value: 'year', label: 'Año' },
  ] as const;
  readonly calendarView = signal<'day' | 'week' | 'month' | 'year'>('month');
  private readonly urlDelCalendario = sincronizarConLaUrl('vista', this.calendarView, 'month', (v) =>
    ['day', 'week', 'month', 'year'].includes(v),
  );
  readonly calendarReturnDate = signal<string | null>(null);
  readonly cardPaymentMode = signal(false);
  readonly cardPaymentAmount = signal(500000);
  readonly cardPurchases = computed(() => {
    const id = this.selectedAccount()?.id;
    return this.store
      .data()
      .movements.filter((m) => m.accountId === id && m.amount < 0 && m.kind === 'expense')
      .slice(0, 12);
  });
  readonly cardDebt = computed(() => {
    const account = this.selectedAccount();
    return account
      ? Math.max(0, -this.store.balance(account)) ||
          this.cardPurchases().reduce((sum, m) => sum + Math.abs(m.amount), 0)
      : 0;
  });
  readonly paymentAllocation = computed(() => {
    let remaining = Math.max(0, this.cardPaymentAmount());
    return this.cardPurchases().map((m) => {
      const before = Math.abs(m.amount);
      const applied = Math.min(before, remaining);
      remaining -= applied;
      return {
        id: m.id,
        description: m.description,
        installment: m.installmentTotal ? `${m.installmentCurrent}/${m.installmentTotal}` : '1/1',
        before,
        applied,
        after: before - applied,
      };
    });
  });
  readonly appliedPayment = computed(() => this.paymentAllocation().reduce((sum, row) => sum + row.applied, 0));
  readonly cardStatementPurchases = computed(() =>
    this.cardPurchases().reduce((sum, m) => sum + Math.abs(m.amount), 0),
  );
  readonly nextInstallments = computed(() =>
    this.cardPurchases().reduce((sum, m) => sum + Math.abs(m.amount) / Math.max(1, m.installmentTotal ?? 1), 0),
  );
  /**
   * Interes del proximo corte, con la tasa que declara la tarjeta.
   *
   * Antes aplicaba un 0.023 mensual fijo —un 27.6 % anual— a cualquier tarjeta, sin
   * mirar la suya: las de los datos demo declaran 10.2 % y 7.8 %, y la pantalla enseñaba
   * un numero que no salia de ninguna parte bajo el rotulo «Interes estimado». Inventar
   * una cifra en una pantalla de dinero es peor que no darla, porque quien la lee decide
   * con ella.
   *
   * Sin tasa declarada devuelve null y la linea no se pinta.
   */
  readonly cardEstimatedInterest = computed(() => {
    const anual = this.selectedAccount()?.annualRate;
    if (anual === undefined || anual === null || !Number.isFinite(anual)) return null;
    return Math.round(this.cardDebt() * (anual / 100 / 12));
  });
  readonly cardStatementTotal = computed(() =>
    Math.round(this.nextInstallments() + (this.cardEstimatedInterest() ?? 0)),
  );
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  readonly week = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly calendarYear = signal(2026);
  readonly calendarMonth = signal(7);
  readonly selectedCalendarDate = signal('2026-08-18');
  readonly calendarMonths = Array.from({ length: 12 }, (_, value) => ({
    value,
    label: new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(new Date(Date.UTC(2026, value, 1))),
  }));
  readonly calendarDays = computed(() => {
    const year = this.calendarYear();
    const month = this.calendarMonth();
    const first = new Date(Date.UTC(year, month, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(Date.UTC(year, month, index - offset + 1));
      const iso = date.toISOString().slice(0, 10);
      return {
        iso,
        day: date.getUTCDate(),
        current: date.getUTCMonth() === month,
        label: new Intl.DateTimeFormat('es-CO', { dateStyle: 'full', timeZone: 'UTC' }).format(date),
      };
    });
  });
  readonly visibleCalendarDays = computed(() => {
    const view = this.calendarView();
    const days = this.calendarDays();
    if (view === 'month') return days;
    const selected = this.selectedCalendarDate();
    const selectedIndex = Math.max(
      0,
      days.findIndex((day) => day.iso === selected),
    );
    if (view === 'day') return days.slice(selectedIndex, selectedIndex + 1);
    const weekStart = Math.floor(selectedIndex / 7) * 7;
    return days.slice(weekStart, weekStart + 7);
  });
  readonly calendarTitle = computed(() => {
    const date = new Date(`${this.selectedCalendarDate()}T00:00:00Z`);
    const view = this.calendarView();
    if (view === 'year') return String(this.calendarYear());
    if (view === 'day') return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
    if (view === 'week') {
      const days = this.visibleCalendarDays();
      return days.length
        ? `${days[0].day}–${days.at(-1)?.day} de ${this.calendarMonths[this.calendarMonth()].label}`
        : '';
    }
    return `${this.calendarMonths[this.calendarMonth()].label} ${this.calendarYear()}`;
  });
  readonly months = [
    { value: '2026-08', label: 'Agosto 2026' },
    { value: '2026-07', label: 'Julio 2026' },
    { value: '2026-06', label: 'Junio 2026' },
    { value: '2026-05', label: 'Mayo 2026' },
  ];
  readonly themes = [
    { id: 'system', label: 'Igual que el sistema', preview: 'linear-gradient(135deg,#fff 50%,#0b2830 50%)' },
    { id: 'light', label: 'Luz editorial', preview: 'linear-gradient(135deg,#fff 50%,#087f68 50%)' },
    { id: 'dark', label: 'Noche esmeralda', preview: 'linear-gradient(135deg,#082128 50%,#29b98f 50%)' },
    { id: 'ocean', label: 'Azul profundo', preview: 'linear-gradient(135deg,#0a2033 50%,#38bdf8 50%)' },
    { id: 'sand', label: 'Marfil cálido', preview: 'linear-gradient(135deg,#fffaf2 50%,#a24f2a 50%)' },
    { id: 'berry', label: 'Ciruela', preview: 'linear-gradient(135deg,#301a37 50%,#f0abfc 50%)' },
  ] as const;
  readonly fonts = [
    { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
    { label: 'DM Sans', value: "'DM Sans', system-ui, sans-serif" },
    { label: 'Manrope', value: 'Manrope, system-ui, sans-serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Trebuchet', value: "'Trebuchet MS', sans-serif" },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Palatino', value: "'Palatino Linotype', serif" },
    { label: 'Courier', value: "'Courier New', monospace" },
    { label: 'System UI', value: 'system-ui, sans-serif' },
  ];
  readonly fontOptions: readonly UiOption[] = this.fonts.map((font) => ({ value: font.value, label: font.label }));
  readonly languageOptions: readonly UiOption[] = [
    { value: 'es-CO', label: 'Español (Colombia)' },
    { value: 'en-US', label: 'English (United States)' },
    { value: 'pt-BR', label: 'Português (Brasil)' },
    { value: 'fr-FR', label: 'Français' },
  ];
  readonly densityOptions: readonly UiOption[] = [
    { value: 'comfortable', label: 'Cómoda' },
    { value: 'compact', label: 'Compacta' },
  ];
  // Fecha, concepto e importe son las tres columnas que nunca se ocultan en una
  // tabla financiera. El importe estaba al final de nueve y quedaba fuera de
  // pantalla; el resto pasa detras porque se puede desplazar sin perder el dato.
  readonly movementColumns = [
    { key: 'date', label: 'Fecha' },
    { key: 'description', label: 'Descripción' },
    { key: 'amount', label: 'Importe' },
    { key: 'account', label: 'Cuenta o tarjeta' },
    { key: 'effect', label: 'Débito / crédito' },
    { key: 'currency', label: 'Moneda / tasa' },
    { key: 'financing', label: 'Cuotas / préstamo' },
    { key: 'responsibility', label: 'Responsabilidad' },
    { key: 'recurrence', label: 'Recurrencia' },
  ];
  readonly userColumns = [
    { key: 'name', label: 'Miembro' },
    { key: 'email', label: 'Correo' },
    { key: 'role', label: 'Perfil' },
    { key: 'status', label: 'Estado' },
    { key: 'access', label: 'Capacidades' },
  ];
  readonly userRows = this.store.users.map((u) => ({
    name: u.name,
    email: u.email,
    role: u.id === 'demo-owner' ? 'Administradora' : 'Revisor',
    status: 'Activo',
    access: u.capabilities.length + ' capacidades',
  }));
  readonly filteredMovementData = computed(() =>
    this.store.movements().filter((m) => {
      const account = this.store.account(m.accountId);
      const accountType = this.movementAccountType();
      const category = this.movementCategory();
      const operation = this.movementOperation();
      return (
        (accountType === 'all' || account?.type === accountType) &&
        (category === 'all' || m.category === category) &&
        (operation === 'all' ||
          operation === m.kind ||
          (operation === 'loan' && !!m.loanRole) ||
          (operation === 'recurring' && !!m.recurring))
      );
    }),
  );
  readonly movementRows = computed(() =>
    this.filteredMovementData().map((m) => ({
      id: m.id,
      date: this.formatDate(m.date),
      description: m.description,
      account: this.store.account(m.accountId)?.name,
      effect: m.status === 'pending' ? 'Pendiente' : m.amount < 0 ? 'Débito' : 'Crédito',
      financing: m.installmentTotal
        ? `Cuota ${m.installmentCurrent}/${m.installmentTotal}`
        : m.loanRole === 'lent'
          ? 'Préstamo otorgado'
          : m.loanRole === 'borrowed'
            ? 'Préstamo recibido'
            : m.loanRole === 'repayment'
              ? 'Pago de préstamo'
              : 'Una cuota',
      responsibility: m.person ? `Prestado · ${m.person}` : 'Propio',
      recurrence: m.recurring
        ? m.recurrence === 'weekly'
          ? 'Semanal'
          : m.recurrence === 'yearly'
            ? 'Anual'
            : 'Mensual'
        : 'No recurrente',
      currency:
        m.originalCurrency === 'USD'
          ? `USD ${m.originalAmount?.toLocaleString('en-US')} · TRM ${m.exchangeRate?.toLocaleString('es-CO')}`
          : (this.store.account(m.accountId)?.currency ?? 'COP'),
      amount: this.store.money(m.amount),
      raw: m,
    })),
  );
  ngAfterViewInit(): void {
    void this.cargarMiembros();
    if (this.route.snapshot.queryParamMap.get('focus') === 'search')
      queueMicrotask(() => this.searchInput?.nativeElement.focus());
    if (this.page() === 'calendar') void this.loadCalendarProjection();
  }
  /** En pantallas estrechas los filtros arrancan plegados: primero el dinero. */
  readonly filtersOpen = signal(typeof window === 'undefined' || window.innerWidth > 700);
  readonly activeFilterCount = computed(
    () =>
      [
        this.store.query() !== '',
        this.store.period() !== 'all',
        this.store.accountFilter() !== 'all',
        this.movementAccountType() !== 'all',
        this.movementCategory() !== 'all',
        this.movementOperation() !== 'all',
      ].filter(Boolean).length,
  );
  /** El boton de restablecer solo aparece cuando hay algo que restablecer. */
  readonly hasActiveFilters = computed(
    () =>
      this.store.query() !== '' ||
      this.store.period() !== 'all' ||
      this.store.accountFilter() !== 'all' ||
      this.movementAccountType() !== 'all' ||
      this.movementCategory() !== 'all' ||
      this.movementOperation() !== 'all',
  );
  /** Una sola forma de escribir una fecha en toda la aplicacion, con el idioma de las preferencias. */
  formatDate(value: string): string {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat(this.store.preferences().locale, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(parsed);
  }
  @ViewChild('reportsTab') private reportsTabRef?: ReportsTabComponent;
  /** El boton de exportar vive en la cabecera compartida; la logica real es de la pestaña. */
  exportReport(): void {
    this.reportsTabRef?.exportReport();
  }

  /** Exporta los movimientos que hay a la vista, con los filtros aplicados. */
  exportMovements(): void {
    if (!this.can(P.movimientos.exportar)) return;
    const filas = this.movementRows();
    downloadCsv(
      `finanzas-movimientos-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        filas,
        this.movementColumns.map((columna) => ({
          header: columna.label,
          value: (fila: Record<string, unknown>) => fila[columna.key],
        })),
      ),
    );
    this.store.toast.set(`${filas.length} movimientos exportados.`);
  }

  clearFilters() {
    this.store.query.set('');
    this.store.period.set('all');
    this.store.accountFilter.set('all');
    this.movementAccountType.set('all');
    this.movementCategory.set('all');
    this.movementOperation.set('all');
    void this.loadMovementPage(1);
  }
  async loadMovementPage(page: number): Promise<void> {
    // Sin el permiso no se pide: el servidor responderia 403 y el aviso hablaria de un
    // fallo al cargar la pagina, que no es lo que pasa.
    if (this.store.runtime.mode !== 'api' || !this.can(P.movimientos.ver)) return;
    const request = ++this.movementRequest;
    try {
      const period = this.store.period();
      const result = await firstValueFrom(
        this.api.movements({
          page,
          pageSize: this.store.remoteMovementSize(),
          search: this.store.query() || undefined,
          accountId: this.store.accountFilter() === 'all' ? undefined : this.store.accountFilter(),
          period: period === 'all' ? undefined : period,
        }),
      );
      if (request !== this.movementRequest) return;
      this.store.data.update((data) => ({
        ...data,
        movements: result.items.map((item) => this.toRemoteMovement(item)),
      }));
      this.store.remoteMovementPage.set(result.page);
      this.store.remoteMovementSize.set(result.size);
      this.store.remoteMovementTotal.set(result.total);
    } catch (error) {
      if (request !== this.movementRequest) return;
      this.store.toast.set(error instanceof Error ? error.message : 'No se pudo cargar la página solicitada.');
    }
  }
  changeMovementPageSize(size: number) {
    this.store.remoteMovementSize.set(size);
    void this.loadMovementPage(1);
  }
  /**
   * Dos peticiones distintas, con dos permisos distintos y sin dependencia entre ellas.
   *
   * Iban en un `Promise.all` sin comprobar nada, asi que a quien tuviera el calendario y
   * no las recurrencias le fallaba la de recurrencias con un 403, se rechazaba la
   * promesa entera y se perdian tambien las proyecciones, que si podia ver. El aviso
   * decia «no se pudo cargar el calendario proyectado» y el permiso concedido parecia no
   * servir. Cada una se pide si su permiso esta concedido, y si una falla la otra queda.
   */
  async loadCalendarProjection() {
    if (this.store.runtime.mode !== 'api') return;
    const start = `${this.calendarYear()}-${String(this.calendarMonth() + 1).padStart(2, '0')}-01`;
    const end = new Date(Date.UTC(this.calendarYear(), this.calendarMonth() + 1, 0)).toISOString().slice(0, 10);
    const fallos: string[] = [];

    if (this.can(P.calendario.ver)) {
      try {
        this.projectedOccurrences.set(await firstValueFrom(this.api.projectedCalendar(start, end)));
      } catch {
        fallos.push('las proyecciones');
      }
    }
    if (this.can(P.calendario.recurrencias.listar)) {
      try {
        this.recurrences.set(await firstValueFrom(this.api.recurrences()));
      } catch {
        fallos.push('las recurrencias');
      }
    }

    if (fallos.length) this.store.toast.set(`No se pudieron cargar ${fallos.join(' ni ')} del calendario.`);
  }
  async materialize(item: ApiProjectedOccurrence) {
    if (this.store.runtime.mode !== 'api') return this.store.log('Ocurrencia confirmada y registrada');
    try {
      await firstValueFrom(
        this.api.materializeRecurrence(item.recurrence.id, {
          occurrence: item.occurrence,
          idempotencyKey: crypto.randomUUID(),
        }),
      );
      this.store.toast.set('Ocurrencia confirmada y registrada en el libro.');
      await Promise.all([this.loadCalendarProjection(), this.loadMovementPage(1)]);
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : 'No se pudo confirmar la ocurrencia.');
    }
  }
  private toRemoteMovement(source: ApiMovement): import('../core/demo-data').Movement {
    // Misma tabla de invariantes que usa el arranque remoto: aquí estaba
    // duplicada la expresión de signo y la lista de clases escrita a mano.
    return {
      id: source.id,
      date: source.date,
      description: source.description ?? 'Sin descripción',
      accountId: source.links['account'] ?? source.links['card'] ?? '',
      category: source.linkNames['category']?.name ?? 'Sin categoría',
      kind: this.store.kindCatalog().family(source.kind, source.effect, source.flow),
      amount: parseMoney(source.amount.base) * signOf(source.flow, source.effect),
      status: 'confirmed',
      person: source.linkNames['counterparty']?.name,
      ownership: source.links['counterparty'] ? 'loaned' : 'own',
      recurring: Boolean(source.links['recurrence']),
    };
  }
  inspectMovement(row: Record<string, unknown>) {
    this.store.inspect('movement', String(row['id']));
  }
  dayMoves(date: string | number) {
    const iso = typeof date === 'number' ? `2026-08-${String(date).padStart(2, '0')}` : date;
    return this.store.data().movements.filter((movement) => movement.date === iso);
  }
  setAccountQuery(value: string) {
    this.accountQuery.set(value);
    this.accountPage.set(0);
  }
  setAccountType(value: 'all' | 'savings' | 'credit' | 'cash') {
    this.accountType.set(value);
    this.accountPage.set(0);
  }
  setCalendarView(view: 'day' | 'week' | 'month' | 'year') {
    this.calendarView.set(view);
  }
  shiftCalendar(direction: -1 | 1) {
    const selected = new Date(`${this.selectedCalendarDate()}T00:00:00Z`);
    const view = this.calendarView();
    if (view === 'day') selected.setUTCDate(selected.getUTCDate() + direction);
    else if (view === 'week') selected.setUTCDate(selected.getUTCDate() + direction * 7);
    else if (view === 'month') selected.setUTCMonth(selected.getUTCMonth() + direction);
    else selected.setUTCFullYear(selected.getUTCFullYear() + direction);
    this.calendarYear.set(selected.getUTCFullYear());
    this.calendarMonth.set(selected.getUTCMonth());
    this.selectedCalendarDate.set(selected.toISOString().slice(0, 10));
    void this.loadCalendarProjection();
  }
  goCalendarToday() {
    const now = new Date();
    this.calendarYear.set(now.getFullYear());
    this.calendarMonth.set(now.getMonth());
    this.selectedCalendarDate.set(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    );
    void this.loadCalendarProjection();
  }
  openCalendarMonth(month: number) {
    this.calendarMonth.set(month);
    this.selectedCalendarDate.set(`${this.calendarYear()}-${String(month + 1).padStart(2, '0')}-01`);
    this.calendarView.set('month');
    void this.loadCalendarProjection();
  }
  monthMovementCount(month: number) {
    const prefix = `${this.calendarYear()}-${String(month + 1).padStart(2, '0')}`;
    return this.store.data().movements.filter((movement) => movement.date.startsWith(prefix)).length;
  }
  selectCalendarDay(iso: string) {
    this.selectedCalendarDate.set(iso);
    this.calendarReturnDate.set(null);
    const movements = this.dayMoves(iso);
    if (movements.length === 1) {
      this.calendarReturnDate.set(iso);
      this.store.inspect('movement', movements[0].id);
    } else this.store.inspect('day', iso);
  }
  selectAccount(id: string, type: string) {
    this.selectedAccountFilter.set(id);
    this.cardPaymentMode.set(false);
    this.store.inspect(type === 'credit' ? 'card' : 'account', id);
  }
  openDayMovement(id: string) {
    this.calendarReturnDate.set(this.store.inspector()?.id ?? this.selectedCalendarDate());
    this.store.inspect('movement', id);
  }
  returnToCalendarDay() {
    const date = this.calendarReturnDate();
    if (date) this.store.inspect('day', date);
  }
  async confirmCardPayment() {
    const card = this.selectedAccount();
    if (!card || this.appliedPayment() <= 0) return;
    const source = this.store.data().accounts.find((account) => account.type === 'savings');
    await this.store.save({
      kind: 'payment',
      date: new Date().toISOString().slice(0, 10),
      accountId: source?.id ?? '',
      targetId: card.id,
      description: `Abono a ${card.name}`,
      amount: this.appliedPayment(),
      category: 'Pago de tarjeta',
    });
    this.store.inspect('card', card.id);
    this.cardPaymentMode.set(false);
  }
  displayBalance(account: import('../core/demo-data').Account): number {
    const value = this.store.balance(account);
    return account.type === 'credit' ? (value < 0 ? -value : 0) : value;
  }
  readonly selectedMovement = computed(() =>
    this.store.data().movements.find((m) => m.id === this.store.inspector()?.id),
  );
  readonly selectedAccount = computed(() => this.store.account(this.store.inspector()?.id ?? ''));
  readonly selectedPerson = computed(() => this.store.data().people.find((p) => p.id === this.store.inspector()?.id));
  readonly selectedInvestment = computed(() =>
    this.store.data().investments.find((i) => i.id === this.store.inspector()?.id),
  );
  readonly inspectorTitle = computed(() => {
    const s = this.store.inspector();
    if (s?.type === 'movement') return 'Detalle del movimiento';
    if (s?.type === 'card') return this.selectedAccount()?.name ?? 'Detalle de tarjeta';
    if (s?.type === 'day')
      return (
        'Agenda del ' +
        new Intl.DateTimeFormat(this.store.preferences().locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
          new Date(`${s.id}T00:00:00Z`),
        )
      );
    if (s?.type === 'person') return this.selectedPerson()?.name ?? 'Persona';
    if (s?.type === 'investment') return this.selectedInvestment()?.name ?? 'Inversión';
    return 'Detalle de cuenta';
  });
  readonly inspectorAmount = computed(() => {
    const m = this.selectedMovement(),
      a = this.selectedAccount(),
      p = this.selectedPerson(),
      i = this.selectedInvestment();
    return m
      ? this.store.money(m.amount)
      : a
        ? this.store.money(a.type === 'credit' ? Math.max(0, -this.store.balance(a)) : this.store.balance(a))
        : p
          ? this.store.money(p.owed - p.owing)
          : i
            ? this.store.money(i.value)
            : this.dayMoves(this.store.inspector()?.id ?? this.selectedCalendarDate()).length + ' operaciones';
  });
  readonly inspectorSubtitle = computed(
    () =>
      this.selectedMovement()?.description ??
      this.selectedAccount()?.name ??
      this.selectedPerson()?.name ??
      this.selectedInvestment()?.type ??
      'Información relacionada',
  );
  readonly inspectorFacts = computed(() => {
    const m = this.selectedMovement(),
      a = this.selectedAccount(),
      p = this.selectedPerson(),
      i = this.selectedInvestment();
    if (m)
      return [
        ['Fecha', m.date],
        ['Cuenta', this.store.account(m.accountId)?.name ?? '—'],
        ['Categoría', m.category],
        ['Naturaleza', m.amount < 0 ? 'Débito' : 'Crédito'],
        ['Estado', m.status],
        ['Responsabilidad', m.person ? `Prestado a/de ${m.person}` : 'Propia'],
        ['Cuotas', m.installmentTotal ? `${m.installmentCurrent} de ${m.installmentTotal}` : 'Una cuota'],
        ['Recurrencia', m.recurring ? (m.recurrence ?? 'Sí') : 'No recurrente'],
        [
          'Préstamo',
          m.loanRole === 'lent'
            ? 'Otorgado'
            : m.loanRole === 'borrowed'
              ? 'Recibido'
              : m.loanRole === 'repayment'
                ? 'Pago o devolución'
                : 'No aplica',
        ],
        ['Moneda original', m.originalCurrency === 'USD' ? `USD ${m.originalAmount} · TRM ${m.exchangeRate}` : 'COP'],
      ];
    if (a)
      return [
        ['Terminación', a.lastFour ? '•••• ' + a.lastFour : SIN_DATO],
        ['Moneda', a.currency],
        [
          'TRM de referencia',
          a.currency === 'USD' ? (a.exchangeRate?.toLocaleString('es-CO') ?? 'Sin definir') : 'No aplica',
        ],
        ['Corte', a.cutDay ? String(a.cutDay) : 'No aplica'],
        ['Pago', a.dueDay ? String(a.dueDay) : 'No aplica'],
        ['Límite', a.limit ? this.store.money(a.limit) : 'No aplica'],
      ];
    if (p)
      return [
        ['Me debe', this.store.money(p.owed)],
        ['Le debo', this.store.money(p.owing)],
        ['Saldo', this.store.money(p.owed - p.owing)],
      ];
    if (i)
      return [
        ['Tipo', i.type],
        ['Costo', this.store.money(i.cost)],
        ['Valor', this.store.money(i.value)],
        ['Variación', formatReturnRate(i.value, i.cost)],
      ];
    return [
      ['Fecha', this.store.inspector()?.id ?? this.selectedCalendarDate()],
      ['Operaciones', String(this.dayMoves(this.store.inspector()?.id ?? this.selectedCalendarDate()).length)],
    ];
  });
  editSelected() {
    const m = this.selectedMovement();
    if (m) this.store.open(m.kind, m.accountId, m);
  }
  async reverseSelected() {
    const movement = this.selectedMovement();
    if (!movement) return;
    if (this.store.runtime.mode === 'demo') {
      this.store.data.update((data) => ({
        ...data,
        movements: data.movements.filter((item) => item.id !== movement.id),
      }));
      this.store.inspector.set(null);
      this.store.log('Movimiento reversado con trazabilidad');
      return;
    }
    try {
      await firstValueFrom(
        this.api.reverseMovement(movement.id, {
          date: new Date().toISOString().slice(0, 10),
          reason: 'Reversado desde la aplicación',
        }),
      );
      this.store.inspector.set(null);
      this.store.toast.set('Movimiento reversado; el original permanece en el historial.');
      await this.loadMovementPage(this.store.remoteMovementPage());
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : 'No se pudo reversar el movimiento.');
    }
  }
  async shareSelected() {
    const movement = this.selectedMovement();
    const person = this.store.data().people.find((item) => item.name === movement?.person);
    if (!movement || !person) return;
    if (this.store.runtime.mode === 'demo') return this.store.log('Compra compartida registrada');
    try {
      await firstValueFrom(
        this.api.createSharedPurchase({
          purchaseMovement: movement.id,
          shares: [{ counterparty: person.id, basis: 1, percent: { rate: '1' } }],
          description: movement.description,
        }),
      );
      this.store.toast.set('Compra compartida registrada con trazabilidad.');
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : 'No se pudo registrar el reparto.');
    }
  }
  async issueSelectedSettlement() {
    const person = this.selectedPerson();
    if (!person) return;
    if (this.store.runtime.mode === 'demo') return this.store.log('Liquidación generada');
    const today = new Date().toISOString().slice(0, 10);
    const start = `${today.slice(0, 7)}-01`;
    try {
      await firstValueFrom(
        this.api.issueSettlement({
          counterparty: person.id,
          period: { start, end: today },
          cutOff: today,
          currency: 'COP',
        }),
      );
      this.store.toast.set(`Liquidación generada para ${person.name}.`);
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : 'No se pudo generar la liquidación.');
    }
  }
  async deactivateSelectedAccount() {
    const account = this.selectedAccount();
    if (!account || account.type === 'credit') return;
    if (this.store.runtime.mode === 'demo') {
      this.store.data.update((data) => ({ ...data, accounts: data.accounts.filter((item) => item.id !== account.id) }));
      this.store.inspector.set(null);
      this.store.log('Cuenta desactivada; el histórico se conserva');
      return;
    }
    try {
      await firstValueFrom(
        this.api.updateAccount(account.id, {
          name: account.name,
          lastFour: account.lastFour ?? null,
          isDefault: false,
          isActive: false,
        }),
      );
      this.store.data.update((data) => ({ ...data, accounts: data.accounts.filter((item) => item.id !== account.id) }));
      this.store.inspector.set(null);
      this.store.toast.set('Cuenta desactivada. Sus movimientos permanecen en el historial.');
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : 'No se pudo desactivar la cuenta.');
    }
  }
  async readAll() {
    if (this.store.runtime.mode === 'api') {
      try {
        const unread = this.store.data().notifications.filter((item) => !item.read);
        await Promise.all(unread.map((item) => firstValueFrom(this.api.markNotificationRead(item.id))));
      } catch (error) {
        this.store.toast.set(error instanceof Error ? error.message : 'No se pudieron actualizar las notificaciones.');
        return;
      }
    }
    this.store.data.update((d) => ({ ...d, notifications: d.notifications.map((n) => ({ ...n, read: true })) }));
  }
  async mark(id: string) {
    if (this.store.runtime.mode === 'api') {
      try {
        await firstValueFrom(this.api.markNotificationRead(id));
      } catch (error) {
        this.store.toast.set(error instanceof Error ? error.message : 'No se pudo actualizar la notificación.');
        return;
      }
    }
    this.store.data.update((d) => ({
      ...d,
      notifications: d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  }
  reviewNotification(id: string) {
    const pending = this.store.data().movements.find((movement) => movement.status === 'pending');
    this.store.open('expense', pending?.accountId ?? 'credit-indigo', pending, id);
  }
  setTheme(theme: (typeof this.themes)[number]['id']) {
    this.store.preferences.update((p) => ({ ...p, theme }));
    applyTheme(theme);
    this.persistPreferences();
  }
  setFont(font: string) {
    this.store.preferences.update((p) => ({ ...p, font }));
    document.documentElement.style.setProperty('--font', font);
    this.persistPreferences();
  }
  setLocale(locale: string) {
    this.store.preferences.update((value) => ({ ...value, locale }));
    this.store.log('Formato regional actualizado');
    this.persistPreferences();
  }
  setAccent(accent: string) {
    this.store.preferences.update((value) => ({ ...value, accent }));
    document.documentElement.style.setProperty('--accent', accent);
    this.persistPreferences();
  }
  setThemeValue(key: 'name' | 'primary' | 'secondary' | 'text' | 'surface' | 'border', value: string) {
    this.store.preferences.update((preferences) => ({ ...preferences, [key]: value }));
    const cssKey = (
      {
        primary: '--accent',
        secondary: '--secondary',
        text: '--text',
        surface: '--surface',
        border: '--line',
      } as Record<string, string>
    )[key];
    if (cssKey) document.documentElement.style.setProperty(cssKey, value);
  }
  saveCustomTheme() {
    this.persistPreferences();
    this.store.log(`Tema “${this.store.preferences().name}” guardado`);
  }
  setDensity(density: 'comfortable' | 'compact') {
    this.store.preferences.update((value) => ({ ...value, density }));
    document.documentElement.dataset['density'] = density;
    this.persistPreferences();
  }
  setRadius(radius: number | string) {
    const value = Number(radius);
    this.store.preferences.update((preferences) => ({ ...preferences, radius: value }));
    document.documentElement.style.setProperty('--radius', `${value}px`);
    this.persistPreferences();
  }
  chartPoints(values: readonly number[], maximum: number, width: number, height: number): string {
    const safeMaximum = Math.max(1, maximum);
    const drawableHeight = height - 20;
    return values
      .map((value, index) => {
        const x = values.length < 2 ? width / 2 : (index / (values.length - 1)) * width;
        const y = 10 + drawableHeight - (Math.max(0, value) / safeMaximum) * drawableHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }
  private persistPreferences() {
    void this.store
      .persistPreferences()
      .catch((error) =>
        this.store.toast.set(error instanceof Error ? error.message : 'No fue posible guardar las preferencias.'),
      );
  }
  async logout(): Promise<void> {
    await this.arranque.cerrarSesion();
  }
}
