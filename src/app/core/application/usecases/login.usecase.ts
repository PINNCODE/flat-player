import { Injectable } from "@angular/core";
import { AuthRepository } from "../../domain/ports/auth.repository";
import { ICredentials } from "../../domain/models/credentials.model";

@Injectable({
    providedIn: "root"
})
export class LoginUseCase{
    constructor(private authRepository: AuthRepository){}

    execute(credentials: ICredentials) {
        return this.authRepository.login(credentials);
    }
}