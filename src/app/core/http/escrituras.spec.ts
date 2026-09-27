import { describe, expect, it } from 'vitest';
import { esEscritura } from './interceptores';

describe('qué petición cuenta como escritura', () => {
  it('una búsqueda por POST no avisa de cambios y un alta sí', () => {
    expect(esEscritura('POST', 'http://localhost:5198/api/v1/movements/search')).toBe(false);
    expect(esEscritura('POST', 'http://localhost:5198/api/v1/movements/search?x=1')).toBe(false);
    expect(esEscritura('POST', 'http://localhost:5198/api/v1/movements')).toBe(true);
    expect(esEscritura('PUT', 'http://localhost:5198/api/v1/accounts/1')).toBe(true);
    expect(esEscritura('GET', 'http://localhost:5198/api/v1/accounts')).toBe(false);
  });
});
