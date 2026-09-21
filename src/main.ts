import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app';
import { API_TRANSPORT, HttpApiTransport } from './app/core/api/api-client';
import { patchConsole } from './app/core/utils/console-buffer';
import { RemoteBootstrap } from './app/core/session/remote-bootstrap';
import { ErrorReporter } from './app/core/telemetry/error-reporter';
import { I18nService } from './app/core/i18n';
import { PREFERENCES } from './app/core/state/theme';
import { routes } from './app/routes';

// Antes de arrancar Angular: para que el reporte de bugs pueda incluir los logs de
// arranque, no solo los que ocurran despues de que el usuario abra el formulario.
patchConsole();

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    { provide: API_TRANSPORT, useClass: HttpApiTransport },
    provideAppInitializer(() => inject(I18nService).load(inject(PREFERENCES)().locale)),
    provideAppInitializer(() => inject(ErrorReporter).start()),
    provideAppInitializer(() => inject(RemoteBootstrap).start()),
  ],
}).catch(console.error);
