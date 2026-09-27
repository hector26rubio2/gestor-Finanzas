import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { accionInterceptor, cifradoInterceptor, escriturasInterceptor } from '@core/http';
import { inject, provideAppInitializer } from '@angular/core';
import { TitleStrategy, provideRouter } from '@angular/router';
import { AppComponent } from '@app/app';
import { API_TRANSPORT, HttpApiTransport } from '@core/api';
import { patchConsole } from '@core/utils';
import { RemoteBootstrap } from '@core/session';
import { ErrorReporter } from '@core/telemetry';
import { I18nService } from '@core/i18n';
import { PREFERENCES } from '@core/state';
import { routes } from '@app/routes';
import { FinanzasTitleStrategy } from '@core/routing';

// Antes de arrancar Angular: para que el reporte de bugs pueda incluir los logs de
// arranque, no solo los que ocurran despues de que el usuario abra el formulario.
patchConsole();

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    { provide: TitleStrategy, useClass: FinanzasTitleStrategy },
    provideHttpClient(withInterceptors([accionInterceptor, escriturasInterceptor, cifradoInterceptor])),
    { provide: API_TRANSPORT, useClass: HttpApiTransport },
    provideAppInitializer(() => inject(I18nService).load(inject(PREFERENCES)().locale)),
    provideAppInitializer(() => inject(ErrorReporter).start()),
    provideAppInitializer(() => inject(RemoteBootstrap).start()),
  ],
}).catch(console.error);
