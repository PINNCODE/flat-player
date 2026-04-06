export class Credentials {
    constructor(
        public readonly user: string,
        public readonly password: string,
        public readonly host: string,
    ) {
        if (!user || user.trim() === '') {
            throw new Error('Debes ingresar un usuario válido.');
        }
        if (!password || password.trim() === '') {
            throw new Error('La contraseña no puede estar vacía.');
        }
        if (!host || (!host.startsWith('http://') && !host.startsWith('https://'))) {
            throw new Error('El host debe ser una URL válida (http/https).');
        }
    }

    get username(): string {
        return this.user;
    }

    get userPassword(): string {
        return this.password;
    }

    get userHost(): string {
        return this.host;
    }

    get credentialsObject(): ICredentials {
        return {
            user: this.user,
            password: this.password,
            host: this.host,
        }
    }

}

export interface ICredentials {
    user: string;
    password: string;
    host: string;
}