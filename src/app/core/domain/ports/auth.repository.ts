import { Observable } from "rxjs";
import { IAuthResponse } from "../models/auth-response.model";
import { ICredentials } from "../models/credentials.model";

export abstract class AuthRepository {
    abstract login(credentials: ICredentials): Observable<IAuthResponse>;
}