# Teclado Virtual de Tizen - Ejemplo de Uso

El teclado virtual de Tizen permite a los usuarios ingresar texto usando el control remoto de Samsung TV.

## TizenKeyboardAdapter

Adaptador que proporciona una API unificada para el teclado virtual de Tizen.

### Uso Básico

```typescript
import { Component } from '@angular/core';
import { TizenKeyboardAdapter } from './infrastructure/adapters/tizen/tizen-keyboard.adapter';

@Component({
  selector: 'app-example',
  standalone: true,
  template: `<div>Contenido</div>`
})
export class ExampleComponent {
  private keyboardAdapter = inject(TizenKeyboardAdapter);

  showKeyboard(): void {
    this.keyboardAdapter.show({
      type: 'text',
      placeholder: 'Ingresa texto',
      initialValue: '',
      maxLength: 50
    }).subscribe({
      next: (result) => {
        if (!result.cancelled) {
          console.log('Texto ingresado:', result.text);
        }
      }
    });
  }
}
```

### Tipos de Teclado

```typescript
// Teclado de texto general
this.keyboardAdapter.showText({
  placeholder: 'Nombre'
}).subscribe(...);

// Teclado para URLs
this.keyboardAdapter.showUrl({
  placeholder: 'https://ejemplo.com'
}).subscribe(...);

// Teclado para email
this.keyboardAdapter.showEmail({
  placeholder: 'usuario@ejemplo.com'
}).subscribe(...);

// Teclado numérico
this.keyboardAdapter.showNumber({
  placeholder: '12345'
}).subscribe(...);

// Teclado para contraseñas
this.keyboardAdapter.showPassword({
  placeholder: 'Contraseña'
}).subscribe(...);
```

### Opciones del Teclado

```typescript
interface TizenKeyboardOptions {
  type?: 'text' | 'url' | 'email' | 'number' | 'password';
  placeholder?: string;
  initialValue?: string;
  maxLength?: number;
  autocorrect?: boolean;
  autocapitalize?: boolean;
}
```

## VirtualKeyboardDirective

Directiva que integra automáticamente el teclado virtual con inputs de Angular.

### Uso en Template

```html
<input
  type="text"
  class="form-input"
  placeholder="Ingresa texto"
  appVirtualKeyboard="text"
  keyboardPlaceholder="Ingresa texto"
/>
```

### Tipos de Teclado en Directiva

```html
<!-- Texto general -->
<input appVirtualKeyboard="text" />

<!-- URL -->
<input appVirtualKeyboard="url" />

<!-- Email -->
<input appVirtualKeyboard="email" />

<!-- Número -->
<input appVirtualKeyboard="number" />

<!-- Contraseña -->
<input appVirtualKeyboard="password" />
```

### Inputs de la Directiva

| Input | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `appVirtualKeyboard` | `'text' \| 'url' \| 'email' \| 'number' \| 'password'` | `'text'` | Tipo de teclado |
| `keyboardPlaceholder` | `string` | - | Placeholder del teclado |
| `keyboardMaxLength` | `number` | - | Longitud máxima |
| `keyboardAutocorrect` | `boolean` | `true` | Corrección automática |
| `keyboardAutocapitalize` | `boolean` | `true` | Capitalización automática |
| `disableVirtualKeyboard` | `boolean` | `false` | Deshabilitar teclado virtual |

### Outputs de la Directiva

| Output | Tipo | Descripción |
|--------|------|-------------|
| `keyboardShown` | `EventEmitter<void>` | Emitido cuando se muestra el teclado |
| `keyboardHidden` | `EventEmitter<void>` | Emitido cuando se oculta el teclado |
| `keyboardConfirm` | `EventEmitter<string>` | Emitido cuando el usuario confirma |
| `keyboardCancel` | `EventEmitter<void>` | Emitido cuando el usuario cancela |

### Control Manual del Teclado

```typescript
import { Component, ViewChild, ElementRef } from '@angular/core';
import { VirtualKeyboardDirective } from './shared/directives/virtual-keyboard.directive';

@Component({
  selector: 'app-example',
  standalone: true,
  template: `
    <input
      #myInput
      type="text"
      appVirtualKeyboard="text"
      (keyboardConfirm)="onConfirm($event)"
    />
    <button (click)="openKeyboard()">Abrir Teclado</button>
    <button (click)="closeKeyboard()">Cerrar Teclado</button>
  `
})
export class ExampleComponent {
  @ViewChild('myInput', { read: VirtualKeyboardDirective })
  keyboardDirective!: VirtualKeyboardDirective;

  openKeyboard(): void {
    this.keyboardDirective.openKeyboard();
  }

  closeKeyboard(): void {
    this.keyboardDirective.closeKeyboard();
  }

  onConfirm(text: string): void {
    console.log('Texto confirmado:', text);
  }
}
```

## Ejemplo Completo en Formulario

```typescript
import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { VirtualKeyboardDirective } from './shared/directives/virtual-keyboard.directive';

@Component({
  selector: 'app-form-example',
  standalone: true,
  imports: [ReactiveFormsModule, VirtualKeyboardDirective],
  template: `
    <form [formGroup]="form">
      <div class="form-group">
        <label>Nombre</label>
        <input
          type="text"
          formControlName="name"
          appVirtualKeyboard="text"
          keyboardPlaceholder="Tu nombre"
        />
      </div>

      <div class="form-group">
        <label>Email</label>
        <input
          type="email"
          formControlName="email"
          appVirtualKeyboard="email"
          keyboardPlaceholder="tu@email.com"
        />
      </div>

      <div class="form-group">
        <label>Sitio Web</label>
        <input
          type="url"
          formControlName="website"
          appVirtualKeyboard="url"
          keyboardPlaceholder="https://ejemplo.com"
        />
      </div>

      <div class="form-group">
        <label>Teléfono</label>
        <input
          type="tel"
          formControlName="phone"
          appVirtualKeyboard="number"
          keyboardPlaceholder="1234567890"
          keyboardMaxLength="10"
        />
      </div>

      <button type="submit">Enviar</button>
    </form>
  `
})
export class FormExampleComponent {
  form: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      name: [''],
      email: [''],
      website: [''],
      phone: ['']
    });
  }
}
```

## Comportamiento en Diferentes Entornos

### Tizen (Producción)

- Usa `tizen.textinput.show()` nativo
- Teclado virtual se muestra automáticamente al recibir foco
- Funciona con control remoto Samsung TV

### Navegador (Desarrollo)

- La directiva detecta que Tizen no está disponible
- No interfiere con el input nativo del navegador
- El usuario puede escribir con teclado físico del PC

## Consideraciones de UX para TV

1. **Activación automática**: El teclado se muestra automáticamente al recibir foco
2. **Placeholder claro**: Usa placeholders descriptivos para guiar al usuario
3. **Tipo apropiado**: Usa el tipo de teclado correcto para cada campo
4. **Longitud máxima**: Establece `maxLength` para evitar entradas excesivas
5. **Cancelación**: El usuario puede cancelar sin perder el foco

## Errores Comunes

### Teclado no se muestra

```
Causa: Tizen no está disponible o textinput no está implementado
Solución: Verificar que la app corre en Tizen Studio o emulador
```

### Input no actualiza el valor

```
Causa: El input no tiene formControlName o [(ngModel)]
Solución: Agregar formControlName o ngModel al input
```

### Teclado se muestra pero no acepta entrada

```
Causa: El input está deshabilitado o readonly
Solución: Remover atributo disabled o readonly
```

## Testing

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TizenKeyboardAdapter } from './tizen-keyboard.adapter';
import { VirtualKeyboardDirective } from './virtual-keyboard.directive';

describe('VirtualKeyboardDirective', () => {
  let component: TestComponent;
  let fixture: ComponentFixture<TestComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [VirtualKeyboardDirective],
      declarations: [TestComponent],
      providers: [TizenKeyboardAdapter]
    });
    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should show keyboard on focus', () => {
    const input = fixture.nativeElement.querySelector('input');
    input.focus();
    // Verificar que el teclado se muestra
  });
});
```

## Referencias

- [Tizen Text Input API](https://developer.samsung.com/smarttv/develop/api-references/tizen-api/latest/tizen/textinput.html)
- [Samsung TV UX Guidelines](https://developer.samsung.com/smarttv/develop/guides/design/ux-guidelines.html)
