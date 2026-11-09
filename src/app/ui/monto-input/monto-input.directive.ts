import { Directive, ElementRef, effect, forwardRef, inject, input, untracked } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { PREFERENCES } from '@core/state/theme';
import { TECLAS_DE_CONTROL } from '@ui/numeric-input/numeric-input.directive';

interface Separadores {
  grupo: string;
  decimal: string;
}

function separadoresDe(locale: string): Separadores {
  const partes = new Intl.NumberFormat(locale).formatToParts(11111.1);
  return {
    grupo: partes.find((parte) => parte.type === 'group')?.value ?? ',',
    decimal: partes.find((parte) => parte.type === 'decimal')?.value ?? '.',
  };
}

function limite(valor: unknown): number | undefined {
  if (valor === null || valor === undefined || valor === '') return undefined;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : undefined;
}

function normalizar(canonico: string): string {
  const [entero, decimales] = canonico.split('.');
  const limpio = entero.replace(/^0+(?=\d)/, '') || '0';
  return decimales === undefined ? (canonico === '' ? '' : limpio) : `${limpio}.${decimales}`;
}

function canonicoDePegado(texto: string, separadores: Separadores): string | null {
  const limpio = texto.replace(/[\s  ]/g, '');
  if (!/^[\d.,]+$/.test(limpio) || !/\d/.test(limpio)) return null;
  const ultimoPunto = limpio.lastIndexOf('.');
  const ultimaComa = limpio.lastIndexOf(',');
  let decimal: string | null = null;
  if (ultimoPunto >= 0 && ultimaComa >= 0) decimal = ultimoPunto > ultimaComa ? '.' : ',';
  else {
    const unico = ultimoPunto >= 0 ? '.' : ',';
    const apariciones = limpio.split(unico).length - 1;
    const comoMiles = new RegExp(`^\\d{1,3}\\${unico}\\d{3}$`).test(limpio);
    if (apariciones === 1 && (unico === separadores.decimal || !comoMiles)) decimal = unico;
  }
  const otro = decimal === '.' ? ',' : '.';
  const partes = decimal ? limpio.split(decimal) : [limpio];
  if (partes.length > 2) return null;
  const entera = partes[0]
    .split(otro)
    .join('')
    .split(decimal ?? otro)
    .join('');
  const fraccion = partes[1]?.split(otro).join('');
  return fraccion === undefined ? entera : `${entera}.${fraccion}`;
}

@Directive({
  selector: 'input[finMonto]',
  host: {
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    '(keydown)': 'onKeydown($event)',
    '(input)': 'onInput()',
    '(paste)': 'onPaste($event)',
    '(blur)': 'onBlur()',
  },
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MontoInputDirective), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => MontoInputDirective), multi: true },
  ],
})
export class MontoInputDirective implements ControlValueAccessor, Validator {
  private readonly campo = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private readonly preferencias = inject(PREFERENCES);
  readonly minimo = input(undefined, { alias: 'min', transform: limite });
  readonly maximo = input(undefined, { alias: 'max', transform: limite });

  private valor: number | null = null;
  private alCambiar: (valor: number | null) => void = () => {};
  private alTocar: () => void = () => {};

  constructor() {
    effect(() => {
      const { locale } = this.preferencias();
      if (!locale) return;
      untracked(() => this.mostrar(this.canonicoActual(), null));
    });
  }

  private get separadores(): Separadores {
    return separadoresDe(this.preferencias().locale);
  }

  private get permiteDecimales(): boolean {
    const paso = this.campo.getAttribute('step');
    return paso === null || paso === 'any' || !Number.isInteger(Number(paso));
  }

  writeValue(valor: number | string | null): void {
    const numero = valor === null || valor === undefined || valor === '' ? null : Number(valor);
    this.valor = numero !== null && Number.isFinite(numero) ? numero : null;
    this.campo.value = this.valor === null ? '' : this.formatear(String(this.valor));
  }

  registerOnChange(fn: (valor: number | null) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.campo.disabled = deshabilitado;
  }

  validate(control: AbstractControl): ValidationErrors | null {
    const valor = control.value;
    if (typeof valor !== 'number') return null;
    const minimo = this.minimo();
    const maximo = this.maximo();
    if (minimo !== undefined && valor < minimo) return { min: { min: minimo, actual: valor } };
    if (maximo !== undefined && valor > maximo) return { max: { max: maximo, actual: valor } };
    return null;
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Backspace' || event.key === 'Delete') return this.saltarSeparador(event);
    if (TECLAS_DE_CONTROL.has(event.key) || event.key.length !== 1) return;
    if (/[0-9]/.test(event.key)) return;
    event.preventDefault();
    if ((event.key === '.' || event.key === ',') && this.permiteDecimales) this.reemplazarSeleccion('.');
  }

  onInput(): void {
    const texto = this.campo.value;
    const caret = this.campo.selectionStart ?? texto.length;
    this.mostrar(this.canonico(texto), this.significativos(texto.slice(0, caret)));
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pegado = canonicoDePegado(event.clipboardData?.getData('text') ?? '', this.separadores);
    if (pegado === null || (!this.permiteDecimales && pegado.includes('.'))) return;
    this.reemplazarSeleccion(pegado);
  }

  onBlur(): void {
    this.alTocar();
    const acotado = this.acotar(this.valor);
    this.mostrar(acotado === null ? '' : String(acotado), null);
  }

  private acotar(valor: number | null): number | null {
    if (valor === null) return null;
    const minimo = this.minimo() ?? -Infinity;
    const maximo = this.maximo() ?? Infinity;
    return Math.min(maximo, Math.max(minimo, valor));
  }

  private saltarSeparador(event: KeyboardEvent): void {
    const { selectionStart: inicio, selectionEnd: fin, value } = this.campo;
    if (inicio === null || inicio !== fin) return;
    const adelante = event.key === 'Delete';
    const vecino = adelante ? value[inicio] : value[inicio - 1];
    if (vecino === undefined || vecino !== this.separadores.grupo) return;
    event.preventDefault();
    const destino = adelante ? inicio + 1 : inicio - 1;
    this.campo.setSelectionRange(destino, destino);
  }

  private reemplazarSeleccion(insertado: string): void {
    const texto = this.campo.value;
    const inicio = this.campo.selectionStart ?? texto.length;
    const fin = this.campo.selectionEnd ?? inicio;
    const antes = this.canonico(texto.slice(0, inicio));
    const despues = this.canonico(texto.slice(fin));
    const unido = this.conservarUnDecimal(`${antes}${insertado}${despues}`);
    const significativos = antes.length + insertado.length;
    this.mostrar(unido, significativos);
  }

  private canonico(texto: string): string {
    const { grupo, decimal } = this.separadores;
    return this.conservarUnDecimal(texto.split(grupo).join('').split(decimal).join('.'));
  }

  private conservarUnDecimal(texto: string): string {
    let resultado = '';
    let hayDecimal = false;
    for (const caracter of texto) {
      if (/[0-9]/.test(caracter)) resultado += caracter;
      else if (caracter === '.' && !hayDecimal && this.permiteDecimales) {
        resultado += '.';
        hayDecimal = true;
      }
    }
    return resultado;
  }

  private canonicoActual(): string {
    return this.valor === null ? '' : String(this.valor);
  }

  private significativos(texto: string): number {
    const { decimal } = this.separadores;
    return [...texto].filter((caracter) => /[0-9]/.test(caracter) || caracter === decimal).length;
  }

  private formatear(canonico: string): string {
    const normal = normalizar(canonico.startsWith('.') ? `0${canonico}` : canonico);
    if (normal === '') return '';
    const [entero, decimales] = normal.split('.');
    const { grupo, decimal } = this.separadores;
    const agrupado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, grupo);
    return decimales === undefined ? agrupado : `${agrupado}${decimal}${decimales}`;
  }

  private posicionTras(texto: string, significativos: number): number {
    if (significativos <= 0) return 0;
    const { decimal } = this.separadores;
    let contados = 0;
    for (let i = 0; i < texto.length; i += 1) {
      if (/[0-9]/.test(texto[i]) || texto[i] === decimal) contados += 1;
      if (contados === significativos) return i + 1;
    }
    return texto.length;
  }

  private mostrar(canonico: string, significativos: number | null): void {
    const texto = this.formatear(canonico);
    const normal = canonico.startsWith('.') ? `0${canonico}` : canonico;
    const numero = normal === '' ? null : Number(normal);
    const nuevo = numero !== null && Number.isFinite(numero) ? numero : null;
    const enfocado = document.activeElement === this.campo || significativos !== null;
    if (this.campo.value !== texto) this.campo.value = texto;
    if (significativos !== null && enfocado) {
      const posicion = this.posicionTras(texto, significativos);
      this.campo.setSelectionRange(posicion, posicion);
    }
    if (nuevo === this.valor) return;
    this.valor = nuevo;
    this.alCambiar(nuevo);
  }
}
