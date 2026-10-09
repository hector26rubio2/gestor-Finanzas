import { Injector, Type, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, CanDeactivateFn, CanMatchFn, Router, Routes, UrlTree } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { safeReturnPath } from '@core/session/return-url';
import { RemoteBootstrap } from '@core/session/remote-bootstrap';
import type { Carga } from '@core/session/remote-slices';
import { CAPABILITIES, AppStore, FEATURES, navigation } from '@core/state/store';
import { CLAVE_DE_PRECARGA } from '@core/routing/precarga';

const guard: CanMatchFn = (route) => {
  const store = inject(AppStore);
  const router = inject(Router);
  const injector = inject(Injector);
  const capacidades = inject(CAPABILITIES);
  const funcionalidades = inject(FEATURES);
  const solicitada = router.currentNavigation()?.extractedUrl.toString() ?? null;

  const decidir = (): boolean | UrlTree => {
    if (!store.user()) {
      const volver = safeReturnPath(solicitada);
      const distinta = volver && volver !== '/dashboard';
      return router.createUrlTree(['/login'], distinta ? { queryParams: { returnUrl: volver } } : {});
    }

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

  if (store.remoteState() !== 'loading') return decidir();
  return toObservable(store.remoteState, { injector }).pipe(
    filter((estado) => estado !== 'loading'),
    take(1),
    map(decidir),
  );
};
const workspaceFeatureLoader: Record<string, () => Promise<Type<unknown>>> = {
  movements: () => import('@features/movements/movements-tab').then((m) => m.MovementsTabComponent),
  calendar: () => import('@features/calendar/calendar-tab').then((m) => m.CalendarTabComponent),
  accounts: () => import('@features/accounts/accounts-tab').then((m) => m.AccountsTabComponent),
  people: () => import('@features/people/people-tab').then((m) => m.PeopleTabComponent),
  portfolio: () => import('@features/portfolio/portfolio-tab').then((m) => m.PortfolioTabComponent),
  planning: () => import('@features/planning/planning-tab').then((m) => m.PlanningTabComponent),
  reports: () => import('@features/reports/reports-tab').then((m) => m.ReportsTabComponent),
  notifications: () => import('@features/notifications/notifications-tab').then((m) => m.NotificationsTabComponent),
  settings: () => import('@features/preferences/preferences-tab').then((m) => m.PreferencesTabComponent),
};

interface CargaDeRuta {
  readonly movimientos?: boolean;
  readonly datos?: readonly Carga[];
}

const CARGAS_POR_RUTA: Readonly<Record<string, CargaDeRuta>> = {
  movements: { movimientos: true },
  calendar: { movimientos: true },
  accounts: { movimientos: true },
  people: { datos: ['debts'] },
  portfolio: { datos: ['investments'] },
  planning: { datos: ['debts', 'investments'] },
  reports: { datos: ['investments'] },
  notifications: { datos: ['notifications'] },
};

const cargarAlEntrar =
  (ruta: string): CanActivateFn =>
  async () => {
    const carga = CARGAS_POR_RUTA[ruta];
    if (!carga) return true;
    const injector = inject(Injector);
    if (carga.datos) void injector.get(RemoteBootstrap).asegurar(...carga.datos);
    if (carga.movimientos) {
      const { MovementsBookService } = await import('@shared/movements/movements-book.service');
      void injector.get(MovementsBookService).asegurarPrimeraPagina();
    }
    return true;
  };

const sinCambiosPendientes: CanDeactivateFn<{ puedeSalir(): boolean | Promise<boolean> }> = (component) =>
  component.puedeSalir();

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('@pages/login/login').then((m) => m.LoginComponent) },
  {
    path: 'sin-acceso',
    loadComponent: () => import('@pages/sin-seccion/sin-seccion').then((m) => m.SinSeccionComponent),
  },
  ...navigation.map((n) => {
    if (n.path === 'dashboard')
      return {
        path: n.path,
        title: `nav.${n.path}`,
        canMatch: [guard],
        data: { capability: n.capability },
        loadComponent: () => import('@pages/dashboard/dashboard').then((m) => m.DashboardComponent),
      };
    if (n.path === 'admin')
      return {
        path: n.path,
        title: `nav.${n.path}`,
        canMatch: [guard],
        canDeactivate: [sinCambiosPendientes],
        data: { capability: n.capability },
        loadComponent: () => import('@pages/admin/admin').then((m) => m.AdminComponent),
      };
    return {
      path: n.path,
      title: `nav.${n.path}`,
      canMatch: [guard],
      canActivate: [cargarAlEntrar(n.path)],
      data: { capability: n.capability },
      loadComponent: () => import('@pages/workspace/workspace').then((m) => m.WorkspaceComponent),
      children: [{ path: '', data: { [CLAVE_DE_PRECARGA]: n.path }, loadComponent: workspaceFeatureLoader[n.path] }],
    };
  }),
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: '**',
    title: 'notFound.title',
    loadComponent: () => import('@pages/no-encontrada/no-encontrada').then((m) => m.NoEncontradaComponent),
  },
];
