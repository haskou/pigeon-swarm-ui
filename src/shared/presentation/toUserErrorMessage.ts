import { HttpJsonError } from '../infrastructure/http/httpJsonError';
import { copy } from './i18n/en';

type BackendErrorBody = {
  code?: number | string;
  httpStatus?: number;
  message?: string;
};

const backendErrorMessages = copy.errors.backend;

export function toUserErrorMessage(
  caught: unknown,
  fallback: string = copy.errors.fallback,
): string {
  if (caught instanceof HttpJsonError) {
    return httpErrorMessage(caught, fallback);
  }

  if (caught instanceof TypeError) {
    return copy.errors.network;
  }

  return caught instanceof Error ? caught.message : fallback;
}

function httpErrorMessage(error: HttpJsonError, fallback: string): string {
  const body = parseBackendErrorBody(error.bodyText);
  const code = normalizeBackendCode(error.code ?? body?.code);

  if (code) {
    const message = backendErrorMessage(code);

    if (message) return message;
  }

  if (error.status === 400 || error.status === 422) {
    return copy.errors.validation;
  }

  if (error.status === 401) return copy.errors.unauthorized;

  if (error.status === 403) return copy.errors.forbidden;

  if (error.status === 404) return copy.errors.notFound;

  return fallback;
}

function normalizeBackendCode(
  code: number | string | undefined,
): string | null {
  if (code === undefined) return null;

  return String(code);
}

function backendErrorMessage(code: string): string | null {
  return (backendErrorMessages as Record<string, string>)[code] ?? null;
}

function parseBackendErrorBody(bodyText: string): BackendErrorBody | null {
  try {
    const body = JSON.parse(bodyText) as BackendErrorBody;

    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}
