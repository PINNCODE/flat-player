import { Inject, Injectable } from "@angular/core";
import { AuthResponse } from "@core/domain/models/auth-response.model";
import { Credentials } from "@core/domain/models/credentials.model";
import { AUTH_REPOSITORY, AuthRepository } from "@core/domain/ports/auth.repository";
import { AUTH_SESSION_PORT, AuthSessionPort } from "@core/domain/ports/auth-session.port";

@Injectable({
    providedIn: "root"
})
export class LoginUseCase{
    constructor(
        @Inject(AUTH_REPOSITORY) private readonly authRepository: AuthRepository,
        @Inject(AUTH_SESSION_PORT) private readonly authSession: AuthSessionPort,
    ){}

    async execute(credentials: Credentials): Promise<AuthResponse> {
        const response = await this.authRepository.login(credentials);
        this.authSession.store(credentials);
        return response;
    }
}