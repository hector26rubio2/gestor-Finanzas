import { Directive, ElementRef, HostListener, OnInit, booleanAttribute, inject, input } from '@angular/core';

const TECLAS_DE_CONTROL = new Set([
  'Backspace',
  'Delete',
  'Tab',
  'Enter',
  'Escape',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
]);

@Directive({
  selector: 'input[type=number], input[finDigitos]',
})
export class NumericInputDirective implements OnInit {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  readonly conSigno = input(false, { alias: 'finConSigno', transform: booleanAttribute });

  ngOnInit(): void {
    if (this.esNumero && !this.conSigno() && !this.input.hasAttribute('min')) this.input.min = '0';
  }

  private get esNumero(): boolean {
    return this.input.type === 'number';
  }

  private get soloEnteros(): boolean {
    if (!this.esNumero) return true;
    const paso = this.input.getAttribute('step');
    return paso !== null && paso !== 'any' && Number.isInteger(Number(paso));
  }

  private permitido(caracter: string, posicion: number): boolean {
    if (/[0-9]/.test(caracter)) return true;
    if (caracter === '.') return !this.soloEnteros && !this.input.value.includes('.');
    if (caracter === '-') return this.conSigno() && posicion === 0;
    return false;
  }

  private textoValido(texto: string): boolean {
    return [...texto].every((caracter, i) => this.permitido(caracter, i));
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || TECLAS_DE_CONTROL.has(event.key)) return;
    if (event.key.length !== 1) return;
    const posicion = this.esNumero ? (this.input.value.length === 0 ? 0 : 1) : (this.input.selectionStart ?? 0);
    if (!this.permitido(event.key, posicion)) event.preventDefault();
  }

  @HostListener('beforeinput', ['$event'])
  onBeforeInput(event: InputEvent): void {
    if (event.data && !this.esNumero && !this.textoValido(event.data)) event.preventDefault();
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    if (!this.textoValido((event.clipboardData?.getData('text') ?? '').trim())) event.preventDefault();
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    if (!this.textoValido((event.dataTransfer?.getData('text') ?? '').trim())) event.preventDefault();
  }

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent): void {
    if (this.esNumero && document.activeElement === this.input) event.preventDefault();
  }

  @HostListener('blur')
  onBlur(): void {
    const corregido = this.corregir(this.input.value);
    if (corregido === this.input.value) return;
    this.input.value = corregido;
    this.input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private corregir(valor: string): string {
    if (!this.esNumero) return valor.replace(/[^0-9]/g, '');
    if (valor === '') return valor;
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return '';
    const minimo = this.input.min === '' ? -Infinity : Number(this.input.min);
    const maximo = this.input.max === '' ? Infinity : Number(this.input.max);
    const acotado = Math.min(maximo, Math.max(minimo, numero));
    return acotado === numero ? valor : String(acotado);
  }
}
