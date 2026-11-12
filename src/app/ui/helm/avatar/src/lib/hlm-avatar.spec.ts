import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HlmAvatarImports } from '../index';

@Component({
  imports: [HlmAvatarImports],
  template: `
    <hlm-avatar>
      @if (foto(); as src) {
        <img hlmAvatarImage [src]="src" alt="" />
      }
      <span hlmAvatarFallback>AB</span>
    </hlm-avatar>
  `,
})
class AnfitrionAvatar {
  readonly foto = input<string | null>(null);
}

function montar(foto: string | null) {
  const fixture = TestBed.createComponent(AnfitrionAvatar);
  fixture.componentRef.setInput('foto', foto);
  fixture.detectChanges();
  const root: HTMLElement = fixture.nativeElement;
  return {
    fixture,
    avatar: root.querySelector('hlm-avatar') as HTMLElement,
    imagen: root.querySelector('img') as HTMLImageElement | null,
    fallback: root.querySelector('[hlmAvatarFallback]') as HTMLElement,
  };
}

describe('HlmAvatar', () => {
  it('muestra las iniciales cuando no hay imagen', () => {
    const { avatar, imagen, fallback } = montar(null);

    expect(imagen).toBeNull();
    expect(avatar.dataset['status']).toBe('idle');
    expect(fallback.style.visibility).not.toBe('hidden');
  });

  it('muestra las iniciales mientras la imagen no ha cargado o falla', () => {
    const { fixture, avatar, imagen, fallback } = montar('http://localhost/no-existe.png');

    expect(imagen?.style.visibility).toBe('hidden');
    expect(fallback.style.visibility).not.toBe('hidden');

    imagen?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(avatar.dataset['status']).toBe('error');
    expect(imagen?.style.visibility).toBe('hidden');
    expect(fallback.style.visibility).not.toBe('hidden');
  });

  it('muestra la imagen y oculta las iniciales cuando carga', () => {
    const { fixture, avatar, imagen, fallback } = montar('http://localhost/foto.png');

    imagen?.dispatchEvent(new Event('load'));
    fixture.detectChanges();

    expect(avatar.dataset['status']).toBe('loaded');
    expect(imagen?.style.visibility).not.toBe('hidden');
    expect(fallback.style.visibility).toBe('hidden');
  });
});
