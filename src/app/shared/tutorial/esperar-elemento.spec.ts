import { afterEach, describe, expect, it, vi } from 'vitest';
import { esperarElemento } from './esperar-elemento';

function hacerVisible(elemento: HTMLElement): void {
  elemento.getClientRects = () => [{}] as unknown as DOMRectList;
}

describe('esperarElemento', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('resuelve de inmediato si el elemento ya es visible', async () => {
    document.body.innerHTML = '<button data-tour="a"></button>';
    hacerVisible(document.querySelector<HTMLElement>('[data-tour="a"]')!);
    expect(await esperarElemento('[data-tour="a"]', 200)).toBe(true);
  });

  it('resuelve cuando el elemento aparece después', async () => {
    const espera = esperarElemento('[data-tour="b"]', 1000);
    setTimeout(() => {
      const boton = document.createElement('button');
      boton.dataset['tour'] = 'b';
      hacerVisible(boton);
      document.body.appendChild(boton);
    }, 30);
    expect(await espera).toBe(true);
  });

  it('resuelve falso al agotar el tiempo', async () => {
    expect(await esperarElemento('[data-tour="nunca"]', 60)).toBe(false);
  });

  it('un elemento sin caja visible no cuenta', async () => {
    document.body.innerHTML = '<button data-tour="c"></button>';
    expect(await esperarElemento('[data-tour="c"]', 60)).toBe(false);
  });

  it('un contenedor con display contents usa la caja de su primer hijo', async () => {
    document.body.innerHTML = '<div data-tour="d" style="display: contents"><div></div></div>';
    hacerVisible(document.querySelector<HTMLElement>('[data-tour="d"]')!.firstElementChild as HTMLElement);
    expect(await esperarElemento('[data-tour="d"]', 60)).toBe(true);
  });
});
