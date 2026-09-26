import { describe, expect, it } from 'vitest';
import { abrir, esSobre, sellar } from './cifrado';

const nuevaLlave = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

describe('sobre cifrado', () => {
  it('sella y abre el mismo JSON con la misma llave', async () => {
    const llave = await nuevaLlave();
    const sobre = await sellar(llave, JSON.stringify({ monto: '1500.00', moneda: 'COP' }));

    expect(esSobre(sobre)).toBe(true);
    expect(sobre.datos).not.toContain('1500');
    expect(await abrir(llave, sobre)).toEqual({ monto: '1500.00', moneda: 'COP' });
  });

  it('otra llave no abre el sobre', async () => {
    const sobre = await sellar(await nuevaLlave(), '{"secreto":true}');

    await expect(abrir(await nuevaLlave(), sobre)).rejects.toBeDefined();
  });
});
