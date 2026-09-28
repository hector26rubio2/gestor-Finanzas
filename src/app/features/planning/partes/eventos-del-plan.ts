import { ChangeDetectionStrategy, Component } from '@angular/core';
import { computed } from '@angular/core';
import type { UiOption } from '@ui/select';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { FieldComponent } from '@ui/field';
import { UiSelectComponent } from '@ui/select';
import { ParteDelPlan } from './parte-del-plan';
import { NumericInputDirective } from '@ui/numeric-input';

@Component({
  selector: 'fin-eventos-del-plan',
  imports: [NumericInputDirective, FormsModule, HlmButton, HlmInput, FieldComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './eventos-del-plan.html',
  host: { style: 'display: contents' },
})
export class EventosDelPlanComponent extends ParteDelPlan {
  readonly opcionesDeDeuda = computed<UiOption[]>(() =>
    this.sim.deudasDelEscenario().map((d) => ({ value: d.id, label: d.nombre })),
  );
}
