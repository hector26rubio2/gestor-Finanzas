import { describe, expect, it } from 'vitest';
import { textoParaCrear } from './select-or-create';

const bancos = [
  { value: 'b1', label: 'Bancolombia' },
  { value: 'b2', label: 'Davivienda' },
];

describe('textoParaCrear', () => {
  it('ofrece crear lo que se escribió cuando no existe', () => {
    expect(textoParaCrear(bancos, '  Nequi ', true)).toBe('Nequi');
  });

  it('no ofrece crear algo que ya existe, sin importar mayúsculas ni tildes', () => {
    expect(textoParaCrear(bancos, 'bancolombía', true)).toBe('');
  });

  it('no ofrece crear sin texto ni sin permiso', () => {
    expect(textoParaCrear(bancos, '   ', true)).toBe('');
    expect(textoParaCrear(bancos, 'Nequi', false)).toBe('');
  });
});
