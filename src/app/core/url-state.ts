import { WritableSignal, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * Ata una señal a un parámetro de la URL.
 *
 * Antes los filtros, las pestañas y la página de la tabla vivían solo en señales. Eso
 * significa que una vista no se puede compartir —«movimientos de la Visa en agosto» no
 * tiene enlace—, que recargar la pierde, y que volver de una ficha te devuelve a la lista
 * sin filtros. En una aplicación que existe para cruzar datos, es la diferencia entre
 * poder enseñarle algo a alguien y tener que dictarle los pasos.
 *
 * Se navega con `replaceUrl`: un filtro no es un destino. Si cada cambio empujara una
 * entrada al historial, salir de la pantalla costaría tantos «atrás» como filtros se
 * hayan tocado.
 *
 * El valor por defecto no se escribe: una URL sin parámetros es la vista sin filtrar, y
 * así se comparte limpia.
 */
export function sincronizarConLaUrl<T extends string>(
  clave: string,
  senal: WritableSignal<T>,
  porDefecto: T,
  esValido?: (valor: string) => boolean,
): void {
  const router = inject(Router);
  const parametros = toSignal(inject(ActivatedRoute).queryParamMap);

  // Un solo sentido a la vez: sin esto, escribir dispararía la lectura y al revés.
  let aplicando = false;

  // La URL manda al entrar y en cada navegación, que es lo que hace funcionar el
  // botón «atrás» del navegador y abrir un enlace pegado.
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
    if (aplicando) return;
    void router.navigate([], {
      queryParams: { [clave]: valor === porDefecto ? null : valor },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });
}

/**
 * Igual, para una señal numérica. La paginación es el caso: `pagina=3` en la URL en vez
 * de volver siempre a la primera al recargar o al llegar desde un enlace.
 *
 * El parámetro se escribe en base 1 porque es lo que la persona ve en pantalla; dentro
 * se sigue contando desde cero.
 *
 * La clave llega como función y no como texto porque quien la aporta es un input de
 * señal, y esos no tienen valor todavía cuando se construye el componente: leerlo ahí
 * devolvía siempre el valor por defecto y la sincronización no llegaba a registrarse.
 */
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
    if (aplicando || !nombre) return;
    void router.navigate([], {
      queryParams: { [nombre]: indice === 0 ? null : indice + 1 },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });
}
