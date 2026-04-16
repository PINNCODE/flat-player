# Sistema de Autenticación - Ejemplo de Uso

El sistema de autenticación de FlatPlayer está completamente implementado con arquitectura limpia y optimizado para Samsung TV.

## Arquitectura

```
Domain (Modelos)
├── User
├── AuthCredentials
├── AuthSession
└── LoginResponse

Application (Casos de Uso)
├── LoginUseCase - Login con validación
├── AutoLoginUseCase - Recuperación de sesión
└── LogoutUseCase - Cierre de sesión

Infrastructure (Implementación)
├── AuthRepositoryImpl - Coordinador
├── AuthHttpService - Llamadas HTTP
├── TizenStorageAdapter - Almacenamiento Tizen
├── WebStorageAdapter - Almacenamiento Web
└── AuthStorageProvider - Selector de storage

Presentation (UI)
└── LoginPageComponent - Página de login
```

## Uso en Componentes

### Login Manual

```typescript
import { Component } from '@angular/core';
import { LoginUseCase } from './core/application/use-cases/auth/login.use-case';
import { AuthCredentials } from './core/domain/models/user.model';

@Component({
  selector: 'app-example',
  standalone: true,
  template: `<div>Contenido</div>`
})
export class ExampleComponent {
  private loginUseCase = inject(LoginUseCase);

  login(): void {
    const credentials: AuthCredentials = {
      serverUrl: 'https://iptv.example.com',
      username: 'usuario',
      password: 'password'
    };

    this.loginUseCase.execute(credentials).subscribe({
      next: (user) => {
        console.log('Login exitoso:', user);
        // Navegar al dashboard
      },
      error: (error) => {
        console.error('Error de login:', error);
        // Mostrar error al usuario
      }
    });
  }
}
```

### Auto-Login

```typescript
import { Component } from '@angular/core';
import { AutoLoginUseCase } from './core/application/use-cases/auth/auto-login.use-case';

@Component({
  selector: 'app-example',
  standalone: true,
  template: `<div>Contenido</div>`
})
export class ExampleComponent {
  private autoLoginUseCase = inject(AutoLoginUseCase);

  ngOnInit(): void {
    // Intentar auto-login al iniciar
    this.autoLoginUseCase.execute().subscribe({
      next: (user) => {
        if (user) {
          console.log('Auto-login exitoso:', user);
          // Navegar al dashboard
        } else {
          console.log('No hay sesión guardada');
          // Mostrar pantalla de login
        }
      }
    });
  }
}
```

### Logout

```typescript
import { Component } from '@angular/core';
import { LogoutUseCase } from './core/application/use-cases/auth/logout.use-case';

@Component({
  selector: 'app-example',
  standalone: true,
  template: `<div>Contenido</div>`
})
export class ExampleComponent {
  private logoutUseCase = inject(LogoutUseCase);

  logout(): void {
    this.logoutUseCase.execute().subscribe({
      next: () => {
        console.log('Logout exitoso');
        // Navegar a login
      },
      error: (error) => {
        console.error('Error de logout:', error);
        // Navegar a login de todas formas
      }
    });
  }
}
```

### Verificar Sesión Activa

```typescript
import { Component } from '@angular/core';
import { LogoutUseCase } from './core/application/use-cases/auth/logout.use-case';

@Component({
  selector: 'app-example',
  standalone: true,
  template: `<div>Contenido</div>`
})
export class ExampleComponent {
  private logoutUseCase = inject(LogoutUseCase);

  checkSession(): boolean {
    return this.logoutUseCase.hasActiveSession();
  }
}
```

## Validación de Credenciales

```typescript
import { Component } from '@angular/core';
import { LoginUseCase } from './core/application/use-cases/auth/login.use-case';
import { AuthCredentials } from './core/domain/models/user.model';

@Component({
  selector: 'app-example',
  standalone: true,
  template: `<div>Contenido</div>`
})
export class ExampleComponent {
  private loginUseCase = inject(LoginUseCase);

  validateCredentials(): void {
    const credentials: AuthCredentials = {
      serverUrl: 'invalid-url',
      username: 'ab',
      password: '123'
    };

    const validation = this.loginUseCase.validateCredentials(credentials);
    
    if (!validation.isValid) {
      console.error('Errores de validación:', validation.errors);
      // Mostrar errores al usuario
    }
  }
}
```

## Integración con Router

Crear un guard para rutas protegidas:

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AutoLoginUseCase } from '../core/application/use-cases/auth/auto-login.use-case';

export const authGuard: CanActivateFn = () => {
  const autoLoginUseCase = inject(AutoLoginUseCase);
  const router = inject(Router);

  if (autoLoginUseCase.hasValidSession()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};
```

## Configuración del API

El servicio `AuthHttpService` necesita ser configurado según el API del servidor IPTV.

### Respuesta Esperada del API

```json
{
  "success": true,
  "user": {
    "id": "user123",
    "username": "usuario",
    "serverUrl": "https://iptv.example.com"
  },
  "token": "jwt-token-here",
  "refreshToken": "refresh-token-here",
  "expiresAt": "2024-05-15T00:00:00Z"
}
```

### Adaptar `AuthHttpService`

Si el API tiene un formato diferente, modificar `handleLoginSuccess` en `auth-http.service.ts`:

```typescript
private handleLoginSuccess(response: any, credentials: AuthCredentials): LoginResponse {
  // Adaptar según la respuesta real del servidor
  const user: User = {
    id: response.data?.user_id || response.user?.id || credentials.username,
    username: response.data?.username || response.user?.username || credentials.username,
    serverUrl: credentials.serverUrl,
    createdAt: new Date().toISOString(),
    expiresAt: response.expires_at || this.calculateExpiryDate()
  };

  const session: AuthSession = {
    user,
    token: response.access_token || response.token,
    refreshToken: response.refresh_token,
    expiresAt: response.expires_at || this.calculateExpiryDate()
  };

  return { success: true, session };
}
```

## Almacenamiento

### Tizen Storage (Producción)

En Tizen, las credenciales se almacenan en el filesystem virtual:

```
/documents/flatplayer_auth_session
```

### Web Storage (Desarrollo)

En navegador, se usa localStorage con prefijo `flatplayer_`:

```
flatplayer_auth_session
```

## Seguridad

- Las contraseñas se envían solo por HTTPS
- Las sesiones expiran después de 30 días
- Las credenciales se eliminan en logout
- Auto-login verifica expiración de sesión
- Validación de formato de URL

## Testing

```typescript
import { TestBed } from '@angular/core/testing';
import { LoginUseCase } from './login.use-case';
import { AuthRepositoryImpl } from '../../../infrastructure/services/auth.repository.impl';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LoginUseCase, AuthRepositoryImpl]
    });
    useCase = TestBed.inject(LoginUseCase);
  });

  it('should validate credentials correctly', () => {
    const credentials = {
      serverUrl: 'https://example.com',
      username: 'user',
      password: 'pass'
    };

    const result = useCase.validateCredentials(credentials);
    expect(result.isValid).toBe(true);
  });

  it('should reject invalid URL', () => {
    const credentials = {
      serverUrl: 'invalid-url',
      username: 'user',
      password: 'pass'
    };

    const result = useCase.validateCredentials(credentials);
    expect(result.isValid).toBe(false);
    expect(result.errors['serverUrl']).toBeDefined();
  });
});
```

## Errores Comunes

### URL del Servidor Inválida

```
Error: La URL debe comenzar con http:// o https://
```

Solución: Verificar que la URL incluya el protocolo.

### Credenciales Inválidas

```
Error: Credenciales inválidas
```

Solución: Verificar usuario y contraseña con el proveedor IPTV.

### Conexión Fallida

```
Error: No se pudo conectar al servidor. Verifica tu conexión.
```

Solución: Verificar conexión a internet y URL del servidor.

### Sesión Expirada

```
Error: La sesión ha expirado
```

Solución: El auto-login detectará esto y mostrará la pantalla de login nuevamente.
