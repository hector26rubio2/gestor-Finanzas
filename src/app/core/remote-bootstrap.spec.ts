import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinanceApiClient } from './api-client';
import { RemoteBootstrap } from './remote-bootstrap';
import { RUNTIME_CONFIG } from './runtime';
import { DemoStore } from './store';

describe('RemoteBootstrap', () => {
  const emptyPage = { items: [], page: 1, size: 25, total: 0, totalPages: 0, hasNext: false };
  const session = {
    user: { id: 'u1', displayName: 'Lectora', email: 'lectora@example.test', isActive: true },
    organization: {
      id: 'o1',
      name: 'Personal',
      slug: 'personal',
      baseCurrency: 'COP',
      isActive: true,
      createdAt: '',
    },
    capabilities: [1],
    organizations: [],
    expiresAt: '',
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('loads only endpoints allowed by the effective capabilities', async () => {
    const api = {
      session: vi.fn(() => of(session)),
      accounts: vi.fn(() => of([])),
      cards: vi.fn(() => of([])),
      categories: vi.fn(() => of([])),
      people: vi.fn(() => of([])),
      debts: vi.fn(() => of([])),
      investments: vi.fn(() => of([])),
      movements: vi.fn(() => of(emptyPage)),
      preferences: vi.fn(() =>
        of({
          userId: 'u1',
          language: 'es-CO',
          theme: 'light',
          font: 'Inter, system-ui, sans-serif',
          density: 'comfortable',
          baseCurrency: 'COP',
          customThemeJson: null,
          updatedAt: '',
        }),
      ),
      featureFlags: vi.fn(() => of([])),
      notifications: vi.fn(() => of([])),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: RUNTIME_CONFIG, useValue: { mode: 'api', apiBaseUrl: 'https://api.example.test' } },
        { provide: FinanceApiClient, useValue: api },
      ],
    });

    await TestBed.inject(RemoteBootstrap).initialize();

    expect(api.accounts).toHaveBeenCalledOnce();
    expect(api.cards).toHaveBeenCalledOnce();
    expect(api.movements).toHaveBeenCalledWith({ page: 1, pageSize: 25 });
    expect(api.people).not.toHaveBeenCalled();
    expect(api.investments).not.toHaveBeenCalled();
    expect(TestBed.inject(DemoStore).remoteState()).toBe('ready');
  });
});
