import { PendingTasks, WritableSignal, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

function saliendoDeLaRuta(router: Router): boolean {
  const navegacion = untracked(() => router.currentNavigation());
  if (!navegacion) return false;
  const rutaActual = router.url.split(/[?#]/)[0];
  if (rutaActual === '/') return false;
  return navegacion.extractedUrl.toString().split(/[?#]/)[0] !== rutaActual;
}

const cambiosPendientes = new WeakMap<Router, Record<string, string | number | null>>();

function escribirEnLaUrl(router: Router, tareas: PendingTasks, cambios: Record<string, string | number | null>): void {
  const enCola = cambiosPendientes.get(router);
  if (enCola) {
    Object.assign(enCola, cambios);
    return;
  }
  cambiosPendientes.set(router, { ...cambios });
  const terminar = tareas.add();
  queueMicrotask(() => {
    const queryParams = cambiosPendientes.get(router) ?? {};
    cambiosPendientes.delete(router);
    if (saliendoDeLaRuta(router)) return terminar();
    void router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl: true }).finally(terminar);
  });
}

export function sincronizarConLaUrl<T extends string>(
  clave: string,
  senal: WritableSignal<T>,
  porDefecto: T,
  esValido?: (valor: string) => boolean,
): void {
  const router = inject(Router);
  const tareas = inject(PendingTasks);
  const parametros = toSignal(inject(ActivatedRoute).queryParamMap);

  let aplicando = false;

  effect(() => {
    const crudo = parametros()?.get(clave);
    if (crudo === null || crudo === undefined) return;
    if (esValido && !esValido(crudo)) return;
    if (untracked(senal) === crudo) return;
    aplicando = true;
    senal.set(crudo as T);
    aplicando = false;
  });

  effect(() => {
    const valor = senal();
    if (aplicando || saliendoDeLaRuta(router)) return;
    escribirEnLaUrl(router, tareas, { [clave]: valor === porDefecto ? null : valor });
  });
}

export function sincronizarPaginaConLaUrl(clave: () => string | null, senal: WritableSignal<number>): void {
  const router = inject(Router);
  const tareas = inject(PendingTasks);
  const parametros = toSignal(inject(ActivatedRoute).queryParamMap);
  let aplicando = false;

  effect(() => {
    const nombre = clave();
    if (!nombre) return;
    const crudo = parametros()?.get(nombre);
    if (!crudo) return;
    const numero = Number(crudo);
    if (!Number.isInteger(numero) || numero < 1) return;
    if (untracked(senal) === numero - 1) return;
    aplicando = true;
    senal.set(numero - 1);
    aplicando = false;
  });

  effect(() => {
    const nombre = clave();
    const indice = senal();
    if (aplicando || !nombre || saliendoDeLaRuta(router)) return;
    escribirEnLaUrl(router, tareas, { [nombre]: indice === 0 ? null : indice + 1 });
  });
}
