import { AuthResponse } from "@core/domain/models/auth-response.model";
import { Credentials } from "@core/domain/models/credentials.model";

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export interface AuthRepository {
    login(credentials: Credentials): Promise<AuthResponse>;
}