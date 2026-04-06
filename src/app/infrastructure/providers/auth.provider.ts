import { Provider } from "@angular/core";
import { AUTH_REPOSITORY } from "@core/domain/ports/auth.repository";
import { AuthHttpAdapter } from "@infrastructure/adapters/http/auth-http.adapter";

export const authProvider: Provider = {
    provide: AUTH_REPOSITORY,
    useClass: AuthHttpAdapter
} 