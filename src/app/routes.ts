import { inject } from '@angular/core';
import { CanMatchFn, Router, Routes } from '@angular/router';
import { CAPABILITIES, DemoStore, FEATURES, navigation } from './core/store';

/**
 * Deja entrar a una sección, o manda a la primera que sí esté abierta.
 *
 * El rebote iba fijo a `/dashboard`, y el dashboard es una sección más: cuando su bandera
 * no llega —una instalación sin catálogo devuelve la lista vacía, y desde el cambio de
 * criterio una clave ausente cierra la ruta— el guard se mandaba a sí mismo una y otra
 * vez. Eso no se ve como una pantalla vacía: el hilo del navegador se queda girando en el
 * bucle de redirecciones y la pestaña deja de responder entera, sin un solo error en la
 * consola que lo explique.
 *
 * Ahora el destino se calcula: la primera entrada del menú que pase permiso y bandera. Si
 * no pasa ninguna, se va a una pantalla que lo explica, que es donde el bucle termina
 * porque esa ruta no está guardada.
 */
const guard: CanMatchFn = (route) => {
  const store = inject(DemoStore);
  const router = inject(Router);
  const capacidades = inject(CAPABILITIES);
  const funcionalidades = inject(FEATURES);
  if (!store.user()) return router.parseUrl('/login');

  const abierta = (entrada: (typeof navigation)[number]) =>
    capacidades.allows(entrada.capability) && funcionalidades.enabled(entrada.path);

  const path = route.path ?? '';
  const pedida = navigation.find((entrada) => entrada.path === path);
  const permitida = pedida
    ? abierta(pedida)
    : capacidades.allows(route.data?.['capability'] ?? 'read') && funcionalidades.enabled(path);
  if (permitida) return true;

  const destino = navigation.find(abierta);
  return router.parseUrl(destino ? `/${destino.path}` : '/sin-acceso');
};
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.LoginComponent) },
  { path: 'sin-acceso', loadComponent: () => import('./pages/sin-seccion').then((m) => m.SinSeccionComponent) },
  ...navigation.map((n) => ({
    path: n.path,
    canMatch: [guard],
    data: { capability: n.capability },
    loadComponent: () =>
      n.path === 'dashboard'
        ? import('./pages/dashboard').then((m) => m.DashboardComponent)
        : n.path === 'admin'
          ? import('./pages/admin').then((m) => m.AdminComponent)
          : import('./pages/workspace').then((m) => m.WorkspaceComponent),
  })),
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];
