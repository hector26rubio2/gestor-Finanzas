import { Directive, HostListener } from '@angular/core';

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
