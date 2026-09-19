import { ApiCategory } from '../api/api-client';

/**
 * Semilla de categorías en modo demo.
 *
 * El modo demo no tiene backend que las sirva, y antes el formulario de movimiento
 * pintaba una lista fija propia en vez de leer `store.categories()` — una categoría
 * creada a mano no aparecía nunca al registrar un movimiento. Sin transferencias ni
 * pago de tarjeta aquí: esas son un `kind`, no una categoría (no existe categoría
 * neutra, la misma regla que ya aplica el backend).
 */
export const DEMO_CATEGORIES: readonly ApiCategory[] = [
  {
    id: 'demo-cat-food',
    name: 'Alimentación',
    type: 2,
    color: '#f97316',
    icon: '🍽️',
    parent: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'demo-cat-housing',
    name: 'Vivienda',
    type: 2,
    color: '#0ea5e9',
    icon: '🏠',
    parent: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'demo-cat-transport',
    name: 'Transporte',
    type: 2,
    color: '#8b5cf6',
    icon: '🚗',
    parent: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'demo-cat-loans',
    name: 'Préstamos',
    type: 2,
    color: '#ef4444',
    icon: '🏦',
    parent: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'demo-cat-investing',
    name: 'Inversiones',
    type: 2,
    color: '#14b8a6',
    icon: '📈',
    parent: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'demo-cat-other-expense',
    name: 'Otros',
    type: 2,
    color: '#64748b',
    icon: '●',
    parent: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'demo-cat-salary',
    name: 'Salario',
    type: 1,
    color: '#22c55e',
    icon: '💼',
    parent: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'demo-cat-other-income',
    name: 'Otros',
    type: 1,
    color: '#64748b',
    icon: '●',
    parent: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
];
