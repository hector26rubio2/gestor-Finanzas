import { Type, inject } from '@angular/core';
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
/**
 * Cada pestaña del workspace es su propio chunk perezoso: antes todas vivian dentro de
 * `WorkspaceComponent` y navegar a cualquiera de ellas bajaba el mismo chunk "workspace"
 * completo, con las nueve juntas. Ahora `WorkspaceComponent` es solo la cascara compartida
 * (cabecera, Inspector, formularios) y cada entrada aqui es la pestaña real que se monta
 * en su `<router-outlet>`.
 */
const workspaceFeatureLoader: Record<string, () => Promise<Type<unknown>>> = {
  movements: () => import('./features/movements/movements-tab').then((m) => m.MovementsTabComponent),
  calendar: () => import('./features/calendar/calendar-tab').then((m) => m.CalendarTabComponent),
  accounts: () => import('./features/accounts/accounts-tab').then((m) => m.AccountsTabComponent),
  people: () => import('./features/people/people-tab').then((m) => m.PeopleTabComponent),
  portfolio: () => import('./features/portfolio/portfolio-tab').then((m) => m.PortfolioTabComponent),
  planning: () => import('./features/planning/planning-tab').then((m) => m.PlanningTabComponent),
  reports: () => import('./features/reports/reports-tab').then((m) => m.ReportsTabComponent),
  notifications: () => import('./features/notifications/notifications-tab').then((m) => m.NotificationsTabComponent),
  settings: () => import('./features/preferences/preferences-tab').then((m) => m.PreferencesTabComponent),
};

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.LoginComponent) },
  { path: 'sin-acceso', loadComponent: () => import('./pages/sin-seccion').then((m) => m.SinSeccionComponent) },
  ...navigation.map((n) => {
    if (n.path === 'dashboard')
      return {
        path: n.path,
        canMatch: [guard],
        data: { capability: n.capability },
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.DashboardComponent),
      };
    if (n.path === 'admin')
      return {
        path: n.path,
        canMatch: [guard],
        data: { capability: n.capability },
        loadComponent: () => import('./pages/admin/admin').then((m) => m.AdminComponent),
      };
    return {
      path: n.path,
      canMatch: [guard],
      data: { capability: n.capability },
      loadComponent: () => import('./pages/workspace').then((m) => m.WorkspaceComponent),
      children: [{ path: '', loadComponent: workspaceFeatureLoader[n.path] }],
    };
  }),
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];
