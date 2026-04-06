import { Inject, Injectable } from "@angular/core";
import { Credentials } from "@core/domain/models/credentials.model";
import { AUTH_REPOSITORY, AuthRepository } from "@core/domain/ports/auth.repository";

@Injectable({
    providedIn: "root"
})
export class LoginUseCase{
    constructor(@Inject(AUTH_REPOSITORY) private readonly authRepository: AuthRepository){}

    execute(credentials: Credentials) {
        return this.authRepository.login(credentials);
    }
}