import { Injectable } from '@angular/core';
import type { Account, Person, PersonKind } from './view-model';
import type { CondicionesDeTarjeta } from './store';
import { AccountsCommands } from './accounts-commands';
import { CategoriesCommands } from './categories-commands';
import { PeopleCommands } from './people-commands';
import { InvestmentsCommands } from './investments-commands';
import { RecurrenceCommands } from './recurrence-commands';

/**
 * Fachada de fachadas: cada grupo de comandos vive en su propio inyectable
 * (accounts-commands, categories-commands, people-commands, investments-commands,
 * recurrence-commands, todos con DI de constructor). Esta clase solo delega para
 * que los consumidores que inyectan `CatalogCommands` sigan funcionando igual.
 */
@Injectable({ providedIn: 'root' })
export class CatalogCommands {
  constructor(
    private readonly cuentas: AccountsCommands,
    private readonly categorias: CategoriesCommands,
    private readonly personas: PeopleCommands,
    private readonly inversiones: InvestmentsCommands,
    private readonly recurrencias: RecurrenceCommands,
  ) {}

  // Contrapartes y personas
  createCounterparty(
    name: string,
    kind: PersonKind = 'person',
    email?: string,
    relationship?: Person['relationship'],
  ): Promise<Person> {
    return this.personas.createCounterparty(name, kind, email, relationship);
  }
  createPerson(name: string, email?: string, relationship?: Person['relationship'], kind?: PersonKind) {
    return this.personas.createPerson(name, email, relationship, kind);
  }
  updatePerson(
    id: string,
    changes: { name: string; email?: string; relationship?: Person['relationship']; kind?: PersonKind },
  ) {
    return this.personas.updatePerson(id, changes);
  }

  // Cuentas y tarjetas
  createAccount(
    name: string,
    type: Account['type'],
    opening: number,
    currency = 'COP',
    exchangeRate?: number,
    credit?: CondicionesDeTarjeta,
    lastFour?: string,
    issuerId?: string,
  ) {
    return this.cuentas.createAccount(name, type, opening, currency, exchangeRate, credit, lastFour, issuerId);
  }
  updateAccount(
    account: Account,
    changes: { name: string; lastFour?: string; credit?: CondicionesDeTarjeta; issuerId?: string },
  ) {
    return this.cuentas.updateAccount(account, changes);
  }

  // Categorías
  createCategory(name: string, color: string, icon: string, kind: 'income' | 'expense' = 'expense') {
    return this.categorias.createCategory(name, color, icon, kind);
  }
  createCategoryInline(name: string, kind: 'income' | 'expense') {
    return this.categorias.createCategoryInline(name, kind);
  }
  updateCategory(id: string, changes: { name: string; color: string; icon: string }) {
    return this.categorias.updateCategory(id, changes);
  }

  // Inversiones
  createInvestment(name: string, instrumentType: string, currency: string) {
    return this.inversiones.createInvestment(name, instrumentType, currency);
  }
  updateInvestment(id: string, changes: { name: string; instrumentType: string }) {
    return this.inversiones.updateInvestment(id, changes);
  }

  // Recurrencias
  createRecurrence(name: string, amount: number, accountId: string, frequency: number, start: string) {
    return this.recurrencias.createRecurrence(name, amount, accountId, frequency, start);
  }
}
