import { Provider } from "@angular/core";
import { AuthRepository } from "@core/domain/ports/auth.repository";
import { AuthHttpAdapter } from "@infrastructure/adapters/http/auth-http.adapter";

export const authProvider: Provider = {
    provide: AuthRepository,
    useClass: AuthHttpAdapter
} 