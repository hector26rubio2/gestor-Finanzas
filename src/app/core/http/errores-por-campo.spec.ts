import { describe, expect, it } from 'vitest';
import { ApiRequestError, erroresPorCampo } from './api-http-client';

describe('errores por campo de ValidationProblemDetails', () => {
  const problema = (errors: Record<string, string[]>) => new ApiRequestError(400, { title: 'Validación', errors });

  it('toma el primer mensaje de cada campo y pasa la clave a camelCase', () => {
    const errores = erroresPorCampo(
      problema({ Description: ['Obligatoria', 'Muy corta'], 'Items[0].Name': ['Vacío'] }),
    );
    expect(errores).toEqual({ description: 'Obligatoria', 'items.Name': 'Vacío' });
  });

  it('traduce rutas del contrato a los campos del formulario', () => {
    const errores = erroresPorCampo(problema({ 'amount.amount': ['Debe ser mayor a 0'] }), {
      'amount.amount': 'amount',
    });
    expect(errores).toEqual({ amount: 'Debe ser mayor a 0' });
  });

  it('sin errors o con otro tipo de error devuelve vacío', () => {
    expect(erroresPorCampo(new ApiRequestError(500, { title: 'Falla' }))).toEqual({});
    expect(erroresPorCampo(new Error('x'))).toEqual({});
    expect(erroresPorCampo(problema({ vacio: [] }))).toEqual({});
  });
});
