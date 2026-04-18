import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './presentation/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./presentation/pages/login/login').then((m) => m.Login),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./presentation/pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'qr-login',
    loadComponent: () =>
      import('./presentation/pages/qr-login/qr-login').then((m) => m.QrLogin),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
