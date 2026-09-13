import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/i18n';
import { P } from '../../core/permissions';
import { CAPABILITIES, CapabilitiesProvider, DemoStore } from '../../core/store';
import { OverlayComponent } from '../../ui/ui';
import { MovementCategoryFieldComponent } from './movement-category-field';
import { MovementCoreFieldsComponent } from './movement-core-fields';
import { MovementCurrencyFieldsComponent } from './movement-currency-fields';
import { MovementInstallmentFieldsComponent } from './movement-installment-fields';
import { MovementKindOption, MovementKindSelectorComponent } from './movement-kind-selector';
import { MovementLoanFieldsComponent } from './movement-loan-fields';
import { MovementRecurrenceFieldsComponent } from './movement-recurrence-fields';
import { MovementFieldVisibility, MovementVisibilityBuilder } from './movement-visibility-builder';

/**
 * Formulario de movimiento, partido en un componente por grupo de campos.
 *
 * Antes era una sola plantilla que recorría una lista de `FormField` genérica
 * construida por una función de 150 líneas con un `switch` de visibilidad aparte.
 * Cada grupo (cuentas, categoría, moneda, cuotas, préstamo, recurrencia) tiene
 * ahora su propio componente: agregar una regla a "cuotas" ya no obliga a leer las
 * reglas de "préstamo" para no pisarlas.
 *
 * Este componente sigue siendo el único dueño del `model` — los hijos lo reciben
 * por referencia y lo mutan vía `ngModel`, igual que antes lo hacía la plantilla
 * plana. Lo que cambió es quién decide qué mostrar: antes un `fieldVisible(key)`
 * con un `switch`, ahora `MovementVisibilityBuilder`, un objeto con toda la regla
 * de negocio en un solo sitio y sin plantilla de por medio.
 */
@Component({
  selector: 'demo-movement-form',
  standalone: true,
  imports: [
    FormsModule,
    OverlayComponent,
    MovementKindSelectorComponent,
    MovementCoreFieldsComponent,
    MovementCategoryFieldComponent,
    MovementCurrencyFieldsComponent,
    MovementInstallmentFieldsComponent,
    MovementLoanFieldsComponent,
    MovementRecurrenceFieldsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movement-form.html',
  styleUrl: './movement-form.css',
})
export class MovementFormComponent {
  readonly store = inject(DemoStore);
  private readonly capabilities: CapabilitiesProvider = inject(CAPABILITIES);
  readonly i18n = inject(I18nService);
  readonly error = signal('');

  /**
   * Cada figura del ledger se libera por separado: se puede conceder registrar
   * gastos sin conceder transferir. La lista se recorta a lo concedido para que no
   * aparezca un botón que el servidor va a rechazar con un 403.
   */
  readonly types = computed<readonly MovementKindOption[]>(() =>
    [
      { value: 'expense', label: this.i18n.t('form.movement.type.expense'), permiso: P.movimientos.crear },
      { value: 'income', label: this.i18n.t('form.movement.type.income'), permiso: P.movimientos.crear },
      {
        value: 'transfer',
        label: this.i18n.t('form.movement.type.transfer'),
        permiso: P.movimientos.transferencias.crear,
      },
    ].filter((t) => this.capabilities.allows(t.permiso)),
  );

  model: Record<string, any> = {};

  readonly title = computed(() =>
    this.store.form()?.notificationId
      ? this.i18n.t('form.movement.title.review')
      : this.store.form()?.movement
        ? this.i18n.t('form.movement.title.edit')
        : this.i18n.t('form.movement.title.create'),
  );

  constructor() {
    const context = this.store.form()!;
    const m = context.movement;
    this.model = {
      kind: context.kind,
      date: m?.date ?? '2026-08-31',
      accountId: context.accountId ?? m?.accountId ?? '',
      targetId: context.targetId ?? '',
      description: m?.description ?? '',
      amount: Math.abs(m?.amount ?? 0),
      category: m?.category ?? '',
      person: m?.person ?? '',
      id: m?.id,
      notificationId: context.notificationId,
      ownership: m?.ownership ?? 'own',
      recurring: String(m?.recurring ?? false),
      recurrence: m?.recurrence ?? 'monthly',
      installmentCurrent: m?.installmentCurrent ?? 1,
      installmentTotal: m?.installmentTotal ?? 1,
      loanRole: m?.loanRole ?? '',
      loanProduct: '',
      originalCurrency: m?.originalCurrency ?? 'COP',
      originalAmount: m?.originalAmount ?? 0,
      exchangeRate: m?.exchangeRate ?? 4168.35,
    };
  }

  setKind(kind: string) {
    this.model['kind'] = kind;
    this.store.form.update((v) => (v ? { ...v, kind } : v));
  }

  /**
   * No es un `computed()` a propósito: depende de `model.accountId`, que se muta
   * directo (no es un signal), igual que antes lo hacía `fieldVisible`. Angular
   * vuelve a llamar a los métodos de la plantilla en cada verificación, así que
   * sigue leyendo el valor fresco sin nada más que declarar.
   */
  visibility(): MovementFieldVisibility {
    const account = this.store.account(this.model['accountId']);
    const isEditing = !!this.model['id'];
    return new MovementVisibilityBuilder(this.model['kind'], account, isEditing).withAll().build();
  }

  async submit() {
    try {
      this.error.set('');
      // Ultima linea antes de escribir. El servidor tiene la palabra final, pero
      // avisar aqui evita mandar una peticion que va a volver con 403.
      const permiso =
        this.model['kind'] === 'transfer'
          ? P.movimientos.transferencias.crear
          : this.model['kind'] === 'payment'
            ? P.movimientos.pagos.crear
            : this.model['id']
              ? P.movimientos.editar
              : P.movimientos.crear;
      if (!this.capabilities.allows(permiso)) throw new Error(this.i18n.t('form.error.forbidden'));
      if (this.model['loanRole'] && !this.capabilities.allows(P.movimientos.prestamos.crear))
        throw new Error(this.i18n.t('form.movement.error.loanForbidden'));
      if (this.model['loanProduct'] && !this.capabilities.allows(P.movimientos.creditos.crear))
        throw new Error(this.i18n.t('form.movement.error.creditForbidden'));
      const source = this.store.account(this.model['accountId']);
      // Un gasto cargado a una tarjeta se registra como compra a crédito, no como gasto
      // corriente: es otra clase de movimiento y otra concesión.
      if (source?.type === 'credit' && !this.capabilities.allows(P.movimientos.creditos.crear))
        throw new Error(this.i18n.t('form.movement.error.creditPurchaseForbidden'));
      const target = this.store.account(this.model['targetId']);
      if (this.model['kind'] === 'transfer' && (source?.type === 'credit' || target?.type === 'credit'))
        throw new Error(this.i18n.t('form.movement.error.transferCreditForbidden'));
      if (this.model['kind'] === 'income' && source?.type === 'credit')
        throw new Error(this.i18n.t('form.movement.error.incomeCreditForbidden'));
      await this.store.save(this.model as any);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : this.i18n.t('form.movement.error.saveFailed'));
    }
  }
}
