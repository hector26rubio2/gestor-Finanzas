import { Directive, HostListener } from '@angular/core';

/**
 * `<input type="number">` deja teclear signo, notación científica ("e") y letras sueltas:
 * el `min`/`max` nativo solo invalida el valor al enviar, no impide escribirlo. Esta
 * directiva bloquea esas teclas y sanea el pegado para que el campo nunca acepte nada
 * que no sea un dígito o un punto decimal.
 */
@Directive({
  selector: 'input[type=number]',
})
export class NumericInputDirective {
  private static readonly blockedKeys = new Set(['e', 'E', '+', '-']);

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (NumericInputDirective.blockedKeys.has(event.key)) event.preventDefault();
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    if (/[^0-9.]/.test(text)) event.preventDefault();
  }
}
