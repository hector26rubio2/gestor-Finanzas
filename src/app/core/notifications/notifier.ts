type Sonner = (typeof import('@spartan-ng/brain/sonner'))['toast'];

let pending: Promise<Sonner> | null = null;

export function notifier(): Promise<Sonner> {
  pending ??= import('@spartan-ng/brain/sonner').then((module) => module.toast);
  return pending;
}
