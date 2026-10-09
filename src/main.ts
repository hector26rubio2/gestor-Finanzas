import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { accionInterceptor } from '@core/http/accion';
import { registroDePeticionesInterceptor } from '@core/http/registro-de-peticiones';
import { HistorialDeNavegacion } from '@core/routing/historial-de-navegacion';
import { cifradoInterceptor, escriturasInterceptor } from '@core/http/interceptores';
import { ErrorHandler, inject, provideAppInitializer } from '@angular/core';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withNavigationErrorHandler,
  withPreloading,
  withViewTransitions,
} from '@angular/router';
import { PrecargaBajoDemanda } from '@core/routing/precarga';
import { AppComponent } from '@app/app';
import { API_TRANSPORT, HttpApiTransport } from '@core/api/api-client';
import { patchConsole } from '@core/utils/console-buffer';
import { RemoteBootstrap } from '@core/session/remote-bootstrap';
import { ErrorReporter } from '@core/telemetry/error-reporter';
import { I18nService } from '@core/i18n';
import { PREFERENCES } from '@core/state/theme';
import { routes } from '@app/routes';
import { FinanzasTitleStrategy } from '@core/routing/title-strategy';
import {
  FinanzasErrorHandler,
  esChunkPerdido,
  recargarPorVersionNueva,
  urlAbsoluta,
} from '@core/routing/version-nueva';

patchConsole();

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(
      routes,
      withNavigationErrorHandler((error) => {
        if (esChunkPerdido(error.error)) recargarPorVersionNueva(urlAbsoluta(error.url));
      }),
      withComponentInputBinding(),
      withPreloading(PrecargaBajoDemanda),
      withViewTransitions({ skipInitialTransition: true }),
    ),
    { provide: ErrorHandler, useClass: FinanzasErrorHandler },
    { provide: TitleStrategy, useClass: FinanzasTitleStrategy },
    provideHttpClient(
      withInterceptors([accionInterceptor, registroDePeticionesInterceptor, escriturasInterceptor, cifradoInterceptor]),
    ),
    { provide: API_TRANSPORT, useClass: HttpApiTransport },
    provideAppInitializer(() => inject(I18nService).load(inject(PREFERENCES)().locale)),
    provideAppInitializer(() => inject(ErrorReporter).start()),
    provideAppInitializer(() => inject(HistorialDeNavegacion).iniciar()),
    provideAppInitializer(() => inject(RemoteBootstrap).start()),
  ],
}).catch(console.error);
