import { describe, expect, it, vi } from 'vitest';
import { aplicarSiVigente, crearUltimaPeticion } from './ultima-peticion';

const diferida = <T>() => {
  let resolver!: (valor: T) => void;
  let rechazar!: (error: unknown) => void;
  const promesa = new Promise<T>((ok, ko) => {
    resolver = ok;
    rechazar = ko;
  });
  return { promesa, resolver, rechazar };
};

describe('ultima peticion', () => {
  it('solo la ultima peticion iniciada es vigente', () => {
    const ultima = crearUltimaPeticion();
    const primera = ultima.iniciar();
    const segunda = ultima.iniciar();
    expect(primera()).toBe(false);
    expect(segunda()).toBe(true);
  });

  it('ignora la respuesta vieja que llega despues de una nueva', async () => {
    const ultima = crearUltimaPeticion();
    const vieja = diferida<string>();
    const nueva = diferida<string>();
    const alExito = vi.fn();
    const alError = vi.fn();
    const aplicadaVieja = aplicarSiVigente(vieja.promesa, ultima.iniciar(), alExito, alError);
    const aplicadaNueva = aplicarSiVigente(nueva.promesa, ultima.iniciar(), alExito, alError);
    nueva.resolver('nueva');
    await aplicadaNueva;
    vieja.resolver('vieja');
    await aplicadaVieja;
    expect(alExito).toHaveBeenCalledTimes(1);
    expect(alExito).toHaveBeenCalledWith('nueva');
    expect(alError).not.toHaveBeenCalled();
  });

  it('llama al manejador de error cuando falla la ultima', async () => {
    const ultima = crearUltimaPeticion();
    const alExito = vi.fn();
    const alError = vi.fn();
    await aplicarSiVigente(Promise.reject(new Error('x')), ultima.iniciar(), alExito, alError);
    expect(alError).toHaveBeenCalledTimes(1);
    expect(alExito).not.toHaveBeenCalled();
  });

  it('no hace nada cuando falla una peticion vieja', async () => {
    const ultima = crearUltimaPeticion();
    const alExito = vi.fn();
    const alError = vi.fn();
    const vieja = aplicarSiVigente(Promise.reject(new Error('x')), ultima.iniciar(), alExito, alError);
    ultima.iniciar();
    await vieja;
    expect(alError).not.toHaveBeenCalled();
    expect(alExito).not.toHaveBeenCalled();
  });
});
