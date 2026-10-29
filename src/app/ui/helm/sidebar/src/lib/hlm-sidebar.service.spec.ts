import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HlmSidebarService } from './hlm-sidebar.service';

describe('HlmSidebarService', () => {
  const cookieDelSidebar = (doc: Document) =>
    doc.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('sidebar_state='));

  afterEach(() => {
    document.cookie = 'sidebar_state=; path=/; max-age=0';
  });

  it('setOpen guarda la preferencia en la cookie', () => {
    const service = TestBed.inject(HlmSidebarService);
    service.setOpen(true);
    expect(cookieDelSidebar(TestBed.inject(DOCUMENT))).toBe('sidebar_state=true');
  });

  it('applyWithoutPersisting cambia el estado sin tocar la cookie', () => {
    const service = TestBed.inject(HlmSidebarService);
    service.setOpen(true);
    service.applyWithoutPersisting(false);
    expect(service.open()).toBe(false);
    expect(cookieDelSidebar(TestBed.inject(DOCUMENT))).toBe('sidebar_state=true');
  });

  it('persistedOpen lee la última preferencia guardada', () => {
    const service = TestBed.inject(HlmSidebarService);
    service.setOpen(false);
    service.applyWithoutPersisting(true);
    expect(service.persistedOpen()).toBe(false);
    service.setOpen(true);
    expect(service.persistedOpen()).toBe(true);
  });
});
