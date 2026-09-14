import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { ControlContainer, FormsModule, NgForm } from '@angular/forms';
import { I18nService } from '../../core/i18n';
import { TrmApi } from '../../core/api/trm.api';
import { NumericInputDirective } from '../../ui/numeric-input.directive';
import { FieldComponent } from '../../ui/field';

/**
 * Solo aparece cuando la cuenta elegida está denominada en dólares — la moneda ya
 * no se elige libremente, la declara la cuenta. La TRM que se guarda la escribe la
 * persona a mano (la que de verdad le cobró el banco); la oficial del día se
 * muestra al lado, solo de referencia, y si la consulta pública falla el campo
 * manual sigue funcionando igual.
 */
@Component({
  selector: 'demo-movement-currency-fields',
  standalone: true,
  imports: [FormsModule, NumericInputDirective, FieldComponent],
  templateUrl: './movement-currency-fields.html',
  styleUrl: './movement-currency-fields.css',
  host: { style: 'display: contents' },
  // El `<form>` vive en el orquestador: sin esto, el ngModel de este componente
  // registra su propio NgForm aislado en vez de sumarse al del padre.
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
})
export class MovementCurrencyFieldsComponent implements OnInit {
  @Input({ required: true }) model!: Record<string, any>;
  readonly i18n = inject(I18nService);
  private readonly trmApi = inject(TrmApi);
  readonly officialTrm = signal<number | null>(null);
  readonly officialTrmLoading = signal(true);

  ngOnInit() {
    // La cuenta ya dice que esto es en dolares: no hace falta que la persona lo
    // vuelva a elegir en un campo aparte. Va en ngOnInit, no en el constructor:
    // los `@Input()` todavia no estan asignados cuando el constructor corre.
    this.model['originalCurrency'] = 'USD';
    this.trmApi.today().subscribe((value) => {
      this.officialTrm.set(value);
      this.officialTrmLoading.set(false);
    });
  }
}
