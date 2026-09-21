type Sonner = (typeof import('ngx-sonner'))['toast'];

let pending: Promise<Sonner> | null = null;

export function notifier(): Promise<Sonner> {
  pending ??= import('ngx-sonner').then((module) => module.toast);
  return pending;
}
