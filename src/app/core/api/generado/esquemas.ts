import type { components } from './esquema';

export type EsquemaApi<Nombre extends keyof components['schemas']> = components['schemas'][Nombre];
