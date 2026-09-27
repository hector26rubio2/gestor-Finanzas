import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdministrationApi, ApiAdminFeatureFlag, ApiAdminOrganizationFlag } from '@core/api';
import { CAPABILITIES, AppStore } from '@core/state';
import { I18nService } from '@core/i18n';
import { P } from '@core/session';
import { AdminChange } from '@pages/admin/admin-changes';
import { AdminDrafts } from './admin-drafts';

type FlagChange = Extract<AdminChange, { kind: 'flag' }>;

const flagKey = (key: string, organizationId: string | null, userId: string | null) =>
  `flag:${key}:${organizationId ?? '-'}:${userId ?? '-'}`;

@Injectable()
export class AdminFlagsStore {
  private readonly api = inject(AdministrationApi);
  private readonly app = inject(AppStore);
  private readonly caps = inject(CAPABILITIES);
  private readonly i18n = inject(I18nService);
  private readonly drafts = inject(AdminDrafts);

  readonly flags = signal<readonly ApiAdminFeatureFlag[]>([]);
  private readonly flagsByOrganization = signal<Readonly<Record<string, readonly ApiAdminOrganizationFlag[]>>>({});

  readonly platformFlags = computed(() => {
    const rows = new Map<string, ApiAdminFeatureFlag>();
    for (const flag of this.flags()) if (!flag.organizationId && !flag.userId) rows.set(flag.key, flag);
    return [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
  });

  cargarGlobales(): Promise<readonly ApiAdminFeatureFlag[]> {
    return firstValueFrom(this.api.adminFeatureFlags());
  }

  organizationFlagsOf(organizationId: string): readonly ApiAdminOrganizationFlag[] | undefined {
    return this.flagsByOrganization()[organizationId];
  }

  async cargarBanderasDe(organizationId: string): Promise<void> {
    if (!this.caps.allows(P.administracion.banderas.listar)) return;
    try {
      const flags = await firstValueFrom(this.api.adminOrganizationFlags(organizationId));
      this.flagsByOrganization.update((x) => ({ ...x, [organizationId]: flags }));
    } catch {
      this.app.toast.set(this.i18n.t('admin.toast.loadFailed'));
    }
  }

  flagValue(key: string, organizationId: string | null, userId: string | null): boolean {
    const draft = this.drafts.draft('flag', flagKey(key, organizationId, userId));
    if (organizationId && !userId)
      return this.globalFlagValue(key) && (draft?.value ?? this.flagBase(key, organizationId, null));
    if (draft) return draft.value;
    return this.flagBase(key, organizationId, userId);
  }

  globalFlagValue(key: string): boolean {
    return this.drafts.draft('flag', flagKey(key, null, null))?.value ?? this.flagBase(key, null, null);
  }

  flagChanged(key: string, organizationId: string | null, userId: string | null): boolean {
    return this.drafts.has(flagKey(key, organizationId, userId));
  }

  setFlag(key: string, organizationId: string | null, userId: string | null, value: boolean): void {
    this.drafts.put(
      { kind: 'flag', key, organizationId, userId, value },
      value === this.flagBase(key, organizationId, userId),
    );
  }

  async guardar(change: FlagChange): Promise<void> {
    const saved = await firstValueFrom(
      this.api.updateAdminFeatureFlag(change.key, {
        organizationId: change.organizationId,
        userId: change.userId,
        isEnabled: change.value,
      }),
    );
    this.flags.update((flags) => [
      ...flags.filter(
        (f) => !(f.key === change.key && f.organizationId === change.organizationId && f.userId === change.userId),
      ),
      saved,
    ]);
    if (change.organizationId && !change.userId) this.parchearBanderaDeOrganizacion(change);
    else if (!change.organizationId && !change.userId) await this.recargarBanderasDeOrganizaciones();
  }

  private flagBase(key: string, organizationId: string | null, userId: string | null): boolean {
    if (organizationId && !userId) {
      const efectiva = this.flagsByOrganization()[organizationId]?.find((flag) => flag.key === key);
      if (efectiva) return efectiva.organizationValue ?? true;
    }
    const candidatas = this.flags().filter((flag) => flag.key === key);
    const propia = userId
      ? candidatas.find((f) => f.userId === userId && f.organizationId === organizationId)
      : undefined;
    const deOrganizacion = organizationId
      ? candidatas.find((f) => !f.userId && f.organizationId === organizationId)
      : undefined;
    const global = candidatas.find((f) => !f.userId && !f.organizationId);
    return (propia ?? deOrganizacion ?? global)?.isEnabled ?? false;
  }

  private async recargarBanderasDeOrganizaciones(): Promise<void> {
    for (const id of Object.keys(this.flagsByOrganization())) await this.cargarBanderasDe(id);
  }

  private parchearBanderaDeOrganizacion(change: FlagChange): void {
    const id = change.organizationId as string;
    this.flagsByOrganization.update((todas) => {
      const actuales = todas[id];
      if (!actuales) return todas;
      const previa = actuales.find((f) => f.key === change.key);
      const globalEnabled = previa?.globalEnabled ?? true;
      const propia: ApiAdminOrganizationFlag = {
        key: change.key,
        isEnabled: change.value && globalEnabled,
        source: 'organization',
        organizationValue: change.value,
        globalEnabled,
      };
      return {
        ...todas,
        [id]: [...actuales.filter((f) => f.key !== change.key), propia].sort((a, b) => a.key.localeCompare(b.key)),
      };
    });
  }
}
