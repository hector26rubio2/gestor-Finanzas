import { ApiBootstrap, ApiBootstrapPart, ApiInvestment, ApiNotification, ApiSession } from '@core/api/api-client';
import { P } from './permissions';

export type Carga = 'investments';

export const PERMISO_DE_CARGA: Readonly<Record<Carga, string | null>> = {
  investments: P.patrimonio.ver,
};

export interface RawData {
  movementKinds: NonNullable<ApiBootstrap['movementKinds']>;
  accounts: NonNullable<ApiBootstrap['accounts']>;
  cards: NonNullable<ApiBootstrap['cards']>;
  categories: NonNullable<ApiBootstrap['categories']>;
  people: NonNullable<ApiBootstrap['people']>;
  preferences: ApiBootstrap['preferences'];
  investments: readonly ApiInvestment[];
}

export function emptyRaw(): RawData {
  return {
    movementKinds: [],
    accounts: [],
    cards: [],
    categories: [],
    people: [],
    preferences: null,
    investments: [],
  };
}

export function huellaDeCatalogos(boot: ApiBootstrap): string {
  return JSON.stringify(boot, (clave, valor) => (clave === 'session' ? undefined : valor));
}

export function identidadDe(session: ApiSession): string {
  return `${session.user.id}|${session.organization.id}`;
}

export function mismaLista(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((valor, i) => valor === b[i]);
}

export function fusionarCatalogos(previo: RawData, boot: ApiBootstrap): RawData {
  const fallidas = new Set(
    boot.omitted.filter((omision) => omision.reason === 'failed').map((omision) => omision.part),
  );
  const conservar = <T>(parte: ApiBootstrapPart, nuevo: T | null, anterior: T, vacio: T): T =>
    nuevo ?? (fallidas.has(parte) ? anterior : vacio);
  return {
    ...previo,
    movementKinds: conservar('movementKinds', boot.movementKinds, previo.movementKinds, []),
    accounts: conservar('accounts', boot.accounts, previo.accounts, []),
    cards: conservar('cards', boot.cards, previo.cards, []),
    categories: conservar('categories', boot.categories, previo.categories, []),
    people: conservar('people', boot.people, previo.people, []),
    preferences: conservar('preferences', boot.preferences, previo.preferences, null),
  };
}

export function avisosDe(boot: ApiBootstrap): { recientes: readonly ApiNotification[]; sinLeer: number } {
  const resumen = boot.notifications;
  return { recientes: resumen?.latest ?? [], sinLeer: resumen?.unreadCount ?? 0 };
}
