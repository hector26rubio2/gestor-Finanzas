import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Person, PersonKind } from './view-model';
import { FinanceApiClient } from '@core/api/api-client';
import { I18nService } from '@core/i18n';
import { COUNTERPARTY_KIND } from '@core/api/people.api';
import { AppStore } from './store';
import { renombrarEnMovimientos } from './catalog-mappers';

/** Comandos de contrapartes (personas/instituciones) con renombrado en movimientos. */
@Injectable({ providedIn: 'root' })
export class PeopleCommands {
  constructor(
    private readonly store: AppStore,
    private readonly client: FinanceApiClient,
    private readonly i18n: I18nService,
  ) {}

  async createCounterparty(name: string, kind: PersonKind = 'person', email?: string): Promise<Person> {
    const nombre = name.trim();
    if (!nombre) throw new Error(this.i18n.t('form.error.nameRequired'));
    const creada: Person = await firstValueFrom(
      this.client.createPerson({
        displayName: nombre,
        email: email || null,
        kind: kind === 'institution' ? COUNTERPARTY_KIND.institution : COUNTERPARTY_KIND.person,
      }),
    ).then((respuesta) => ({ id: respuesta.id, name: respuesta.displayName, owed: 0, owing: 0, kind, email }));
    this.store.data.update((data) => ({ ...data, people: [...data.people, creada] }));
    return creada;
  }

  async createPerson(
    name: string,
    email?: string,
    relationship: Person['relationship'] = 'Otro',
    kind: PersonKind = 'person',
  ) {
    const creada = await this.createCounterparty(name, kind, email || undefined);
    this.store.data.update((data) => ({
      ...data,
      people: data.people.map((persona) => (persona.id === creada.id ? { ...persona, relationship } : persona)),
    }));
    this.store.form.set(null);
    this.store.toast.set(
      this.i18n.t(kind === 'institution' ? 'toast.institution.created' : 'toast.person.created', { name }),
    );
  }

  async updatePerson(
    id: string,
    changes: { name: string; email?: string; relationship?: Person['relationship']; kind?: PersonKind },
  ) {
    const name = changes.name.trim();
    if (!name) throw new Error(this.i18n.t('form.management.error.nameRequired'));
    const actual = this.store.data().people.find((person) => person.id === id);
    if (!actual) throw new Error(this.i18n.t('form.error.notFound'));
    const email = changes.email?.trim() || undefined;
    const remota = (await firstValueFrom(this.client.people())).find((person) => person.id === id);
    if (!remota) throw new Error(this.i18n.t('form.error.notFound'));
    await firstValueFrom(
      this.client.updatePerson(id, {
        displayName: name,
        alias: remota.alias,
        email: email ?? null,
        phone: remota.phone,
        notes: remota.notes,
        isActive: remota.isActive,
        ...(changes.kind
          ? { kind: changes.kind === 'institution' ? COUNTERPARTY_KIND.institution : COUNTERPARTY_KIND.person }
          : {}),
      }),
    );

    this.store.data.update((data) => ({
      ...data,
      people: data.people.map((person) =>
        person.id === id
          ? {
              ...person,
              name,
              email,
              relationship: changes.relationship ?? person.relationship,
              kind: changes.kind ?? person.kind,
            }
          : person,
      ),
      movements: renombrarEnMovimientos(data.movements, 'person', actual.name, name),
    }));
    this.store.form.set(null);
    this.store.toast.set(this.i18n.t('toast.person.updated', { name }));
  }
}
