import { inject } from '@angular/core';
import { CanMatchFn, Router, Routes } from '@angular/router';
import { CAPABILITIES, DemoStore, FEATURES, navigation } from './core/store';
const guard: CanMatchFn = (route) => {
  const store = inject(DemoStore),
    router = inject(Router);
  if (!store.user()) return router.parseUrl('/login');
  return inject(CAPABILITIES).allows(route.data?.['capability'] ?? 'read') && inject(FEATURES).enabled(route.path ?? '')
    ? true
    : router.parseUrl('/dashboard');
};
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.LoginComponent) },
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
