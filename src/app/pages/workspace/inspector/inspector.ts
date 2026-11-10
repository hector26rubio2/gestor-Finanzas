import { NgTemplateOutlet } from '@angular/common';
import { IconComponent } from '@ui/icon';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { FinanceApiClient } from '@core/api';
import type { ApiSharedPurchase, ApiSettlement } from '@core/api';
import { parseMoney } from '@core/utils';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import { permisoParaEditarCuenta } from '@features/account-form';
import { PeopleStore } from '@features/people';
import type { Account, Movement } from '@core/state';
import { CAPABILITIES, AccountsCommands, AppStore, FEATURES, MovementCommands, PeopleCommands } from '@core/state';
import { puedeReversar } from '@core/state/operacion/reverso';
import { MovementsBookService } from '@shared/movements';
import { BankCardComponent } from '@ui/bank-card';
import { ConfirmDialogComponent } from '@ui/confirm-dialog';
import { DetalleComponent } from '@ui/lista-y-detalle';
import { UiSelectComponent } from '@ui/select';
import { InspectorCard } from './inspector-card';
import { InspectorInversion } from './inspector-inversion';
import { InspectorRecientes } from './inspector-recientes';
import { OrigenDelMovimiento } from './origen-del-movimiento';
import { type ContextoDePresentacion, type EntidadResuelta, presentarEntidad } from './presentacion-de-entidad';

const TIPOS_DE_OPERACION: Readonly<Record<number, string>> = {
  1: 'contribution',
  2: 'withdrawal',
  3: 'buy',
  4: 'sell',
  5: 'dividend',
  6: 'fee',
};
const FUENTES_DE_VALORIZACION: Readonly<Record<number, string>> = { 1: 'marketPrice', 2: 'statement', 3: 'manual' };

@Component({
  selector: 'fin-inspector',
  imports: [
    IconComponent,
    NgTemplateOutlet,
    FormsModule,
    HlmButton,
    HlmInput,
    BankCardComponent,
    ConfirmDialogComponent,
    DetalleComponent,
    UiSelectComponent,
  ],
  templateUrl: './inspector.html',
  host: { class: 'contents' },
})
export class InspectorComponent {
  readonly Math = Math;
  readonly i18n = inject(I18nService);
  readonly store = inject(AppStore);
  readonly P = P;
  readonly parseMoney = parseMoney;
  private readonly capabilities = inject(CAPABILITIES);
  private readonly features = inject(FEATURES);
  private readonly api = inject(FinanceApiClient);
  private readonly movementsBook = inject(MovementsBookService);
  private readonly movementCommands = inject(MovementCommands);
  private readonly accountsCommands = inject(AccountsCommands);
  private readonly peopleCommands = inject(PeopleCommands);

  readonly canReverseSelected = computed(() => {
    const movimiento = this.selectedMovement();
    if (!movimiento) return false;
    return puedeReversar(movimiento, this.store.account(movimiento.accountId)?.type, (permiso) => this.can(permiso));
  });
  can(permiso: string): boolean {
    return this.capabilities.allows(permiso);
  }

  readonly tarjeta = new InspectorCard(() => this.selectedAccount());
  readonly origenDelMovimiento = new OrigenDelMovimiento();
  readonly recientes = new InspectorRecientes(() => (this.isAccountInspector() ? this.selectedAccount() : undefined));
  fechaCorta(iso: string): string {
    const fecha = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(fecha.getTime())) return iso;
    return new Intl.DateTimeFormat(this.store.preferences().locale, {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(fecha);
  }
  verTodosLosMovimientos(id: string) {
    this.store.inspector.set(null);
    this.store.accountFilter.set(id);
    void this.movementsBook.loadMovementPage(1);
  }

  openDayMovement(id: string) {
    this.store.calendarReturnDate.set(this.store.inspector()?.id ?? this.store.selectedCalendarDate());
    this.store.inspect('movement', id);
  }
  returnToCalendarDay() {
    const date = this.store.calendarReturnDate();
    if (date) this.store.inspect('day', date);
  }
  readonly selectedMovement = computed(() => this.store.movimiento(this.store.inspector()?.id));
  readonly selectedAccount = computed(() => this.store.account(this.store.inspector()?.id ?? ''));
  readonly isAccountInspector = computed(() => {
    const type = this.store.inspector()?.type;
    return type === 'card' || type === 'account';
  });
  displayBalance(account: Account): number {
    const value = this.store.balance(account);
    return account.type === 'credit' ? (value < 0 ? -value : 0) : value;
  }
  typeCardLabel(type: Account['type']): string {
    return this.i18n.t(`accounts.cards.type.${type}`);
  }
  private readonly people = inject(PeopleStore);
  private readonly destruccion = inject(DestroyRef);
  private readonly deudasDePersona = effect(() => {
    const inspeccionaPersona = this.store.inspector()?.type === 'person';
    untracked(() =>
      inspeccionaPersona ? this.people.solicitar(this.destruccion) : this.people.soltar(this.destruccion),
    );
  });
  readonly selectedPerson = computed(() => this.people.personas().find((p) => p.id === this.store.inspector()?.id));
  readonly selectedInvestment = computed(() =>
    this.store.data().investments.find((i) => i.id === this.store.inspector()?.id),
  );
  readonly historialDeInversion = new InspectorInversion(() =>
    this.store.inspector()?.type === 'investment' ? this.store.inspector()?.id : undefined,
  );
  fechaDeOperacion(iso: string): string {
    return iso.slice(0, 10);
  }
  claveDeOperacion(tipo: number): string {
    return `form.investment.operation.type.${TIPOS_DE_OPERACION[tipo] ?? 'contribution'}`;
  }
  claveDeFuente(fuente: number): string {
    return `form.investment.valuation.source.${FUENTES_DE_VALORIZACION[fuente] ?? 'manual'}`;
  }
  private readonly entidad = computed<EntidadResuelta>(() => {
    const seleccionada = this.store.inspector();
    switch (seleccionada?.type) {
      case 'movement':
        return { tipo: 'movimiento', movimiento: this.selectedMovement() };
      case 'account':
        return { tipo: 'cuenta', cuenta: this.selectedAccount() };
      case 'card':
        return { tipo: 'tarjeta', cuenta: this.selectedAccount() };
      case 'person':
        return { tipo: 'persona', persona: this.selectedPerson() };
      case 'investment':
        return { tipo: 'inversion', inversion: this.selectedInvestment() };
      default: {
        const fecha = seleccionada?.id ?? this.store.selectedCalendarDate();
        return { tipo: 'dia', fecha, operaciones: this.store.dayMoves(fecha).length };
      }
    }
  });
  private readonly contextoDePresentacion = computed<ContextoDePresentacion>(() => ({
    t: (clave, parametros) => this.i18n.t(clave, parametros),
    money: (valor, moneda) => this.store.money(valor, moneda),
    accountName: (id) => this.store.account(id)?.name,
    accountType: (id) => this.store.account(id)?.type,
    fechaLarga: (iso) =>
      new Intl.DateTimeFormat(this.store.preferences().locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
        new Date(`${iso}T00:00:00Z`),
      ),
    montoDe: (cuenta) => (cuenta.type === 'credit' ? this.store.deudaDe(cuenta) : this.store.balance(cuenta)),
  }));
  private readonly presentacion = computed(() => presentarEntidad(this.entidad(), this.contextoDePresentacion()));
  readonly inspectorTitle = computed(() => this.presentacion().titulo);
  readonly inspectorAmount = computed(() => this.presentacion().monto);
  readonly inspectorSubtitle = computed(() => this.presentacion().subtitulo);
  readonly inspectorFacts = computed(() => this.presentacion().hechos);
  editSelected() {
    const m = this.selectedMovement();
    if (m) this.store.open(m.kind, m.accountId, m);
  }
  askReverse(): void {
    const movement = this.selectedMovement();
    if (!movement) return;
    this.confirmKind.set('reverse');
    this.pendingConfirm.set({ kind: 'reverse', movement, restore: this.store.inspector() });
    this.store.inspector.set(null);
  }
  askDeactivateAccount(): void {
    const account = this.selectedAccount();
    if (!account) return;
    this.confirmKind.set('deactivateAccount');
    this.pendingConfirm.set({ kind: 'deactivateAccount', account, restore: this.store.inspector() });
    this.store.inspector.set(null);
  }
  confirmPending(): void {
    const pending = this.pendingConfirm();
    this.pendingConfirm.set(null);
    if (pending?.kind === 'reverse') void this.reverseMovement(pending.movement);
    else if (pending?.kind === 'deactivateAccount') void this.deactivateAccount(pending.account);
  }
  dismissPending(): void {
    const pending = this.pendingConfirm();
    if (!pending) return;
    this.pendingConfirm.set(null);
    this.store.inspector.set(pending.restore);
  }
  readonly pendingConfirm = signal<
    | { kind: 'reverse'; movement: Movement; restore: ReturnType<AppStore['inspector']> }
    | { kind: 'deactivateAccount'; account: Account; restore: ReturnType<AppStore['inspector']> }
    | null
  >(null);
  private readonly confirmKind = signal<'reverse' | 'deactivateAccount'>('reverse');
  readonly confirmPrefix = computed(() => `workspace.confirm.${this.confirmKind()}`);
  async reverseMovement(movement: Movement) {
    try {
      const pagina = this.store.remoteMovementPage();
      await this.movementCommands.reversar(movement);
      this.store.inspector.set(null);
      this.store.toast.set(this.i18n.t('workspace.messages.movementReversed'));
      await this.movementsBook.loadMovementPage(pagina);
    } catch (error) {
      this.store.toast.set(
        error instanceof Error ? error.message : this.i18n.t('workspace.messages.movementReverseFailed'),
      );
    }
  }
  async shareSelected() {
    const movement = this.selectedMovement();
    if (!movement) return;
    try {
      await this.movementCommands.compartir(movement);
      this.store.toast.set(this.i18n.t('workspace.messages.sharedPurchase'));
    } catch (error) {
      this.store.toast.set(
        error instanceof Error ? error.message : this.i18n.t('workspace.messages.sharedPurchaseFailed'),
      );
    }
  }
  async issueSelectedSettlement() {
    const person = this.selectedPerson();
    if (!person) return;
    try {
      const emitida = await this.peopleCommands.liquidar(person.id, this.store.hoy());
      this.store.toast.set(this.i18n.t('workspace.messages.settlementIssued', { name: person.name }));
      this.personSettlements.update((liquidaciones) => (liquidaciones ? [emitida, ...liquidaciones] : liquidaciones));
    } catch (error) {
      this.store.toast.set(error instanceof Error ? error.message : this.i18n.t('workspace.messages.settlementFailed'));
    }
  }
  readonly personPurchases = signal<
    readonly { id: string; date: string; description: string; share: number; total: number }[] | null
  >(null);
  readonly personSettlements = signal<readonly ApiSettlement[] | null>(null);
  private readonly idDePersonaInspeccionada = computed(() =>
    this.store.inspector()?.type === 'person' ? this.selectedPerson()?.id : undefined,
  );
  private readonly cargaDePersona = effect(() => {
    const id = this.idDePersonaInspeccionada();
    untracked(() => void this.cargarHistorialDePersona(id ?? null));
  });

  private async cargarHistorialDePersona(personId: string | null): Promise<void> {
    this.personPurchases.set(null);
    this.personSettlements.set(null);
    if (!personId || !this.features.enabled('people.history')) return;
    const [compras, liquidaciones] = await Promise.allSettled([
      this.can(P.personas.compras.listar) ? firstValueFrom(this.api.sharedPurchases()) : Promise.resolve(null),
      this.can(P.personas.liquidaciones.listar) ? firstValueFrom(this.api.settlements()) : Promise.resolve(null),
    ]);
    if (this.selectedPerson()?.id !== personId) return;
    if (compras.status === 'fulfilled' && compras.value)
      this.personPurchases.set(this.comprasDe(personId, compras.value));
    if (liquidaciones.status === 'fulfilled' && liquidaciones.value)
      this.personSettlements.set(
        liquidaciones.value
          .filter((settlement) => settlement.counterparty.id === personId)
          .slice()
          .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
      );
  }

  private comprasDe(personId: string, compras: readonly ApiSharedPurchase[]) {
    return compras
      .flatMap((compra) => {
        const parte = compra.allocation.shares.find((share) => share.share.counterparty.id === personId);
        return parte
          ? [
              {
                id: compra.id,
                date: compra.date,
                description: compra.description ?? compra.card.name,
                share: parseMoney(parte.amount),
                total: parseMoney(compra.total),
              },
            ]
          : [];
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  canEditSelectedAccount(): boolean {
    const account = this.selectedAccount();
    return !!account && this.can(permisoParaEditarCuenta(account.type));
  }
  editSelectedPerson(): void {
    const person = this.selectedPerson();
    if (person) this.store.form.set({ kind: 'person', targetId: person.id });
  }
  editSelectedInvestment(): void {
    const investment = this.selectedInvestment();
    if (investment) this.store.form.set({ kind: 'investment', targetId: investment.id });
  }
  registrarOperacion(): void {
    const investment = this.selectedInvestment();
    if (investment) this.store.form.set({ kind: 'investment-operation', targetId: investment.id });
  }
  registrarValorizacion(): void {
    const investment = this.selectedInvestment();
    if (investment) this.store.form.set({ kind: 'investment-valuation', targetId: investment.id });
  }
  editSelectedAccount(): void {
    const account = this.selectedAccount();
    if (!account) return;
    this.store.form.set({ kind: 'account', account });
  }
  async deactivateAccount(account: Account) {
    try {
      await this.accountsCommands.desactivar(account);
      this.store.inspector.set(null);
      this.store.toast.set(this.i18n.t('workspace.messages.accountDeactivated'));
    } catch (error) {
      this.store.toast.set(
        error instanceof Error ? error.message : this.i18n.t('workspace.messages.accountDeactivateFailed'),
      );
    }
  }
}
