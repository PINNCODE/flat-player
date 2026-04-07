import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';

import { HttpLoaderService } from '@infrastructure/services/http-loader.service';

export const httpLoaderInterceptor: HttpInterceptorFn = (request, next) => {
  const httpLoaderService = inject(HttpLoaderService);

  httpLoaderService.startRequest();

  return next(request).pipe(finalize(() => httpLoaderService.endRequest()));
};
