import { Component, input, output } from '@angular/core';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';

@Component({
  selector: 'fin-confirm-dialog',
  imports: [HlmAlertDialogImports],
  template: `
    <hlm-alert-dialog [state]="open() ? 'open' : 'closed'" (stateChanged)="onStateChanged($event)">
      <hlm-alert-dialog-content *hlmAlertDialogPortal="let ctx">
        <hlm-alert-dialog-header>
          <h2 hlmAlertDialogTitle>{{ title() }}</h2>
          <p hlmAlertDialogDescription>{{ description() }}</p>
        </hlm-alert-dialog-header>
        <hlm-alert-dialog-footer>
          <button hlmAlertDialogCancel>{{ cancelLabel() }}</button>
          <button hlmAlertDialogAction variant="destructive" (click)="confirm(ctx)">{{ confirmLabel() }}</button>
        </hlm-alert-dialog-footer>
      </hlm-alert-dialog-content>
    </hlm-alert-dialog>
  `,
})
export class ConfirmDialogComponent {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly cancelLabel = input.required<string>();
  readonly confirmed = output<void>();
  readonly dismissed = output<void>();

  private accepted = false;

  protected confirm(context: { close: () => void }): void {
    this.accepted = true;
    this.confirmed.emit();
    context.close();
  }

  protected onStateChanged(state: 'open' | 'closed'): void {
    if (state !== 'closed') return;
    const wasAccepted = this.accepted;
    this.accepted = false;
    if (!wasAccepted) this.dismissed.emit();
  }
}
