import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./presentation/pages/login/login').then((m) => m.Login),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./presentation/pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
