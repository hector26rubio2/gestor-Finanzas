import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmInput } from '@spartan-ng/helm/input';
import { FieldComponent } from '@ui/field';
import { ParteDelPlan } from './parte-del-plan';
import { NumericInputDirective } from '@ui/numeric-input';

@Component({
  selector: 'fin-deudas-del-plan',
  imports: [NumericInputDirective, FormsModule, HlmButton, HlmCheckbox, HlmInput, FieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './deudas-del-plan.html',
  host: { style: 'display: contents' },
})
export class DeudasDelPlanComponent extends ParteDelPlan {}
