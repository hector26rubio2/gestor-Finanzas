import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app';
import { API_TRANSPORT, HttpApiTransport } from './app/core/api-client';
import { patchConsole } from './app/core/console-buffer';
import { RemoteBootstrap } from './app/core/remote-bootstrap';
import { routes } from './app/routes';

// Antes de arrancar Angular: para que el reporte de bugs pueda incluir los logs de
// arranque, no solo los que ocurran despues de que el usuario abra el formulario.
patchConsole();

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    { provide: API_TRANSPORT, useClass: HttpApiTransport },
    provideAppInitializer(() => inject(RemoteBootstrap).start()),
  ],
}).catch(console.error);
