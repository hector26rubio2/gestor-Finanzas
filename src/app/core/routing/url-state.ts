import { WritableSignal, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

function saliendoDeLaRuta(router: Router): boolean {
  const navegacion = untracked(() => router.currentNavigation());
  if (!navegacion) return false;
  const rutaActual = router.url.split(/[?#]/)[0];
  if (rutaActual === '/') return false;
  return navegacion.extractedUrl.toString().split(/[?#]/)[0] !== rutaActual;
}

export function sincronizarConLaUrl<T extends string>(
  clave: string,
  senal: WritableSignal<T>,
  porDefecto: T,
  esValido?: (valor: string) => boolean,
): void {
  const router = inject(Router);
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
    void router.navigate([], {
      queryParams: { [clave]: valor === porDefecto ? null : valor },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });
}

export function sincronizarPaginaConLaUrl(clave: () => string | null, senal: WritableSignal<number>): void {
  const router = inject(Router);
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
    void router.navigate([], {
      queryParams: { [nombre]: indice === 0 ? null : indice + 1 },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });
}
