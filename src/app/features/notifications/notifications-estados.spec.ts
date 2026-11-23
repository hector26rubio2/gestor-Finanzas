import { type Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { P } from '@core/session';
import { datosDe } from '@testing/datos-de-prueba';
import { pruebaRender } from '@testing/prueba-render';
import { sesionDe } from '@testing/sesion-de-prueba';
import { TransportFalso } from '@testing/transport-falso';
import { NotificationsTabComponent, TAMANO_DE_PAGINA_DE_AVISOS } from './notifications-tab';

const aviso = (n: number, leida = false) => ({
  id: `n${n}`,
  kind: 'permissions.updated',
  title: `Aviso ${n}`,
  detail: '',
  createdAt: new Date(Date.UTC(2026, 9, 1, 0, n)).toISOString(),
  readAt: leida ? '2026-10-02T00:00:00Z' : null,
});

const lote = (cantidad: number, leidasDesde = Number.POSITIVE_INFINITY) =>
  Array.from({ length: cantidad }, (_, i) => aviso(i + 1, i + 1 >= leidasDesde));

async function esperar() {
  await new Promise((listo) => setTimeout(listo));
}

async function montar(transport: TransportFalso) {
  const montado = pruebaRender(NotificationsTabComponent, {
    session: sesionDe().conCapacidad(P.notificaciones.ver, P.notificaciones.editar),
    data: datosDe(),
    providers: [provideRouter([]) as unknown as Provider],
    transport,
  });
  montado.store.organization.set({ id: 'o1', name: 'Personal' });
  montado.store.remoteState.set('ready');
  montado.cambios();
  await montado.estable();
  await esperar();
  montado.cambios();
  await montado.estable();
  montado.cambios();
  return montado;
}

const titulos = () => [...document.body.querySelectorAll('li h3')].map((h) => h.textContent?.trim());
const boton = (testid: string) => document.body.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`);

describe('Notificaciones: paginación, carga y error', () => {
  it('con más avisos que una página muestra solo la primera y ofrece mostrar más', async () => {
    const total = TAMANO_DE_PAGINA_DE_AVISOS + 5;
    const { component } = await montar(
      new TransportFalso().responder('GET /api/v1/notifications', { body: lote(total) }),
    );

    expect(titulos()).toHaveLength(TAMANO_DE_PAGINA_DE_AVISOS);
    expect(component.restantes()).toBe(5);
    expect(boton('mostrar-mas-avisos')).not.toBeNull();
  });

  it('muestra primero los más recientes', async () => {
    const total = TAMANO_DE_PAGINA_DE_AVISOS + 5;
    await montar(new TransportFalso().responder('GET /api/v1/notifications', { body: lote(total) }));

    expect(titulos()[0]).toBe(`Aviso ${total}`);
    expect(titulos()).not.toContain('Aviso 1');
  });

  it('mostrar más agrega la siguiente página y el botón desaparece al llegar al final', async () => {
    const total = TAMANO_DE_PAGINA_DE_AVISOS + 5;
    const { cambios } = await montar(
      new TransportFalso().responder('GET /api/v1/notifications', { body: lote(total) }),
    );

    boton('mostrar-mas-avisos')!.click();
    cambios();

    expect(titulos()).toHaveLength(total);
    expect(titulos()).toContain('Aviso 1');
    expect(boton('mostrar-mas-avisos')).toBeNull();
  });

  it('con pocos avisos no hay botón de mostrar más', async () => {
    await montar(new TransportFalso().responder('GET /api/v1/notifications', { body: lote(3) }));

    expect(titulos()).toHaveLength(3);
    expect(boton('mostrar-mas-avisos')).toBeNull();
  });

  it('cambiar el filtro vuelve a la primera página', async () => {
    const total = TAMANO_DE_PAGINA_DE_AVISOS * 2 + 3;
    const { component, cambios } = await montar(
      new TransportFalso().responder('GET /api/v1/notifications', { body: lote(total) }),
    );
    component.mostrarMas();
    cambios();
    expect(titulos()).toHaveLength(TAMANO_DE_PAGINA_DE_AVISOS * 2);

    component.cambiarFiltro('unread');
    cambios();

    expect(titulos()).toHaveLength(TAMANO_DE_PAGINA_DE_AVISOS);
  });

  it('el filtro de no leídas pagina solo sobre las no leídas', async () => {
    const { component, cambios } = await montar(
      new TransportFalso().responder('GET /api/v1/notifications', { body: lote(30, 11) }),
    );

    component.cambiarFiltro('unread');
    cambios();

    expect(titulos()).toHaveLength(10);
    expect(boton('mostrar-mas-avisos')).toBeNull();
  });

  it('si la carga falla avisa con un botón de reintento', async () => {
    const { component } = await montar(
      new TransportFalso().responder('GET /api/v1/notifications', { error: { status: 500 } }),
    );

    expect(component.fallo()).toBe(true);
    expect(document.body.querySelector('[data-testid="error-de-avisos"]')).not.toBeNull();
    expect(boton('reintentar-avisos')).not.toBeNull();
  });

  it('reintentar vuelve a pedir y, si sale bien, quita el aviso y muestra los avisos', async () => {
    let falla = true;
    const transport = new TransportFalso().responder('GET /api/v1/notifications', () =>
      falla ? { error: { status: 500 } } : { body: lote(3) },
    );
    const { component, cambios } = await montar(transport);
    expect(component.fallo()).toBe(true);

    falla = false;
    boton('reintentar-avisos')!.click();
    await esperar();
    await esperar();
    cambios();

    expect(component.fallo()).toBe(false);
    expect(document.body.querySelector('[data-testid="error-de-avisos"]')).toBeNull();
    expect(titulos()).toHaveLength(3);
  });

  it('sin error no se muestra el aviso de fallo', async () => {
    await montar(new TransportFalso().responder('GET /api/v1/notifications', { body: lote(2) }));

    expect(document.body.querySelector('[data-testid="error-de-avisos"]')).toBeNull();
  });
});
