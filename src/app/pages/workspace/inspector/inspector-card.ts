import { computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  FinanceApiClient,
  ApiWritesBus,
  CARD_BUCKET,
  PRIORIDAD_EN_DOLARES,
  PRIORIDAD_EN_PESOS,
  claveDeConcepto,
  completarPrioridad,
} from '@core/api';
import { isForeignCurrency, parseMoney, sumBy } from '@core/utils';
import { I18nService } from '@core/i18n';
import { toMovement } from '@core/session';
import type { Account, Movement } from '@core/state';
import { AppStore, MovementCommands } from '@core/state';
import { aplicarAbono, comprasPendientes, saldosPorConcepto } from '@shared/tarjetas';

interface ApiCardStatus {
  debt: { amount: string; currency: string };
  availableCredit: { amount: string; currency: string };
  minimumPayment: { amount: string; currency: string };
  currentPeriod: { range: { start: string; end: string }; statementDate: string; dueDate: string };
}

export class InspectorCard {
  private readonly i18n = inject(I18nService);
  private readonly store = inject(AppStore);
  private readonly api = inject(FinanceApiClient);
  private readonly escrituras = inject(ApiWritesBus);
  private readonly movementCommands = inject(MovementCommands);

  constructor(private readonly tarjeta: () => Account | undefined) {}

  readonly cardPaymentAmount = signal(500000);
  readonly cuentaDeOrigen = signal('');
  readonly cuentasDeOrigen = computed(() => this.store.data().accounts.filter((a) => a.type !== 'credit'));
  private readonly origenPorDefecto = effect(() => {
    const cuentas = this.cuentasDeOrigen();
    if (!cuentas.some((c) => c.id === untracked(this.cuentaDeOrigen)))
      this.cuentaDeOrigen.set((cuentas.find((c) => c.type === 'savings') ?? cuentas[0])?.id ?? '');
  });
  readonly opcionesDeOrigen = computed(() => this.cuentasDeOrigen().map((c) => ({ value: c.id, label: c.name })));
  readonly movimientosDeTarjeta = signal<readonly Movement[]>([]);
  readonly estadoDeTarjeta = signal<ApiCardStatus | null>(null);
  private readonly traerTarjeta = effect(() => {
    const tarjeta = this.tarjeta();
    this.escrituras.version();
    if (!tarjeta || tarjeta.type !== 'credit') return;
    untracked(() => {
      void this.cargar(tarjeta.id);
    });
  });

  readonly prioridadDeTarjeta = computed(() => {
    const tarjeta = this.tarjeta();
    return isForeignCurrency(tarjeta?.currency)
      ? completarPrioridad(tarjeta?.foreignPaymentPriority, PRIORIDAD_EN_DOLARES)
      : completarPrioridad(tarjeta?.paymentPriority, PRIORIDAD_EN_PESOS);
  });
  readonly comprasPendientes = computed(() =>
    comprasPendientes(this.movimientosDeTarjeta(), this.prioridadDeTarjeta()),
  );
  readonly saldosPorConcepto = computed(() => saldosPorConcepto(this.comprasPendientes(), this.prioridadDeTarjeta()));
  readonly cardDebt = computed(() => {
    const estado = this.estadoDeTarjeta();
    if (estado) return parseMoney(estado.debt);
    const account = this.tarjeta();
    return account
      ? Math.max(0, -this.store.balance(account)) || sumBy(this.comprasPendientes(), (c) => c.pendiente)
      : 0;
  });
  readonly pagoMinimo = computed(() => {
    const estado = this.estadoDeTarjeta();
    return estado ? parseMoney(estado.minimumPayment) : null;
  });
  readonly periodoActual = computed(() => this.estadoDeTarjeta()?.currentPeriod ?? null);
  readonly paymentAllocation = computed(() =>
    aplicarAbono(this.saldosPorConcepto(), Math.min(this.cardPaymentAmount(), this.cardDebt() || Infinity)),
  );
  readonly appliedPayment = computed(() => sumBy(this.paymentAllocation(), (row) => row.aplicado));
  readonly paymentAllocationRows = computed(() =>
    this.paymentAllocation().map((row, indice) => ({
      id: String(row.concepto),
      order: String(indice + 1),
      description: this.etiquetaDeConcepto(row.concepto),
      installment: String(this.saldosPorConcepto()[indice]?.compras.length ?? 0),
      before: this.store.money(row.antes),
      applied: this.store.money(row.aplicado),
      after: this.store.money(row.despues),
    })),
  );
  readonly paymentAllocationColumns = computed(() => [
    { key: 'order', label: '#' },
    { key: 'description', label: this.i18n.t('workspace.cardPayment.table.bucket') },
    { key: 'installment', label: this.i18n.t('workspace.cardPayment.table.purchases') },
    { key: 'before', label: this.i18n.t('workspace.cardPayment.table.balanceBefore') },
    { key: 'applied', label: this.i18n.t('workspace.cardPayment.table.applied') },
    { key: 'after', label: this.i18n.t('workspace.cardPayment.table.balanceAfter') },
  ]);
  readonly cardStatementPurchases = computed(() => {
    const periodo = this.periodoActual();
    const compras = this.movimientosDeTarjeta().filter((m) => !m.anulado && m.kind === 'expense' && m.amount < 0);
    const delPeriodo = periodo
      ? compras.filter((m) => m.date >= periodo.range.start && m.date <= periodo.range.end)
      : compras.filter((m) => m.date.slice(0, 7) === this.store.hoy().slice(0, 7));
    return sumBy(delPeriodo, (m) => Math.abs(m.amount));
  });
  readonly nextInstallments = computed(() =>
    sumBy(this.comprasPendientes(), (c) => Math.min(c.pendiente, c.cuotaDelMes)),
  );
  readonly cardEstimatedInterest = computed(() => {
    const tasaTarjeta = this.tarjeta()?.annualRate;
    const porId = new Map(this.movimientosDeTarjeta().map((m) => [m.id, m]));
    const intereses = this.comprasPendientes().map((compra) => {
      if (
        compra.concepto === CARD_BUCKET.zeroRatePurchases ||
        compra.concepto === CARD_BUCKET.singleInstallmentPurchases
      )
        return 0;
      const anual = porId.get(compra.id)?.purchaseApr ?? tasaTarjeta;
      return anual !== undefined && anual !== null && Number.isFinite(anual)
        ? compra.pendiente * (anual / 100 / 12)
        : null;
    });
    if (intereses.every((x) => x === null)) return null;
    return Math.round(sumBy(intereses, (x) => x ?? 0));
  });
  readonly cuotaDeManejo = computed(() => this.tarjeta()?.monthlyFee ?? 0);
  readonly cardStatementTotal = computed(() =>
    Math.round(this.nextInstallments() + (this.cardEstimatedInterest() ?? 0) + this.cuotaDeManejo()),
  );

  etiquetaDeConcepto(concepto: number): string {
    return this.i18n.t(`card.bucket.${claveDeConcepto(concepto) ?? 'fees'}`);
  }

  async confirmarAbono(): Promise<void> {
    const card = this.tarjeta();
    if (!card || this.appliedPayment() <= 0) return;
    await this.movementCommands.save({
      kind: 'payment',
      date: this.store.hoy(),
      accountId: this.cuentaDeOrigen(),
      targetId: card.id,
      description: `Abono a ${card.name}`,
      amount: this.appliedPayment(),
      category: 'Pago de tarjeta',
    });
    this.store.inspect('card', card.id);
    this.store.cardPaymentMode.set(false);
  }

  private async cargar(id: string): Promise<void> {
    const catalogo = this.store.kindCatalog();
    const movimientos: Movement[] = [];
    try {
      for (let pagina = 1; pagina <= 20; pagina++) {
        const respuesta = await firstValueFrom(
          this.api.movements({ page: pagina, pageSize: 100, filter: { cards: [id] } }),
        );
        movimientos.push(...respuesta.items.map((m) => toMovement(this.i18n, catalogo, m)));
        if (!respuesta.hasNext) break;
      }
    } catch {
      movimientos.length = 0;
    }
    if (this.tarjeta()?.id !== id) return;
    this.movimientosDeTarjeta.set(movimientos);
    try {
      this.estadoDeTarjeta.set((await firstValueFrom(this.api.cardStatus(id))) as ApiCardStatus);
    } catch {
      this.estadoDeTarjeta.set(null);
    }
  }
}
