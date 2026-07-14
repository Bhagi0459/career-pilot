import { HttpErrorResponse } from '@angular/common/http';
import { resolveApiErrorMessage } from './api-error.util';

function errorResponse(status: number, error: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error });
}

describe('resolveApiErrorMessage', () => {
  it('uses the backend message for an expected 4xx business error, e.g. 401 bad credentials', () => {
    const error = errorResponse(401, { message: 'Invalid email or password.' });

    expect(resolveApiErrorMessage(error, { default: 'fallback' })).toBe('Invalid email or password.');
  });

  it('falls back to the caller-supplied default when a 4xx has no message body', () => {
    const error = errorResponse(400, null);

    expect(resolveApiErrorMessage(error, { default: 'Invalid email or password.' })).toBe(
      'Invalid email or password.'
    );
  });

  it('never reads error.error as a message for a status-0 (CORS/network) failure', () => {
    // status 0 means the browser never got an HTTP response - error.error is an opaque
    // ProgressEvent, not JSON, so treating it as { message } would be wrong even if it happened
    // to have a `.message` property (e.g. ProgressEvent has none, but nothing should assume so).
    const error = errorResponse(0, new ProgressEvent('error'));

    expect(resolveApiErrorMessage(error, { default: 'Invalid email or password.' })).toBe(
      'Unable to connect to the server. Please try again.'
    );
  });

  it('uses a custom connection message when provided', () => {
    const error = errorResponse(0, null);

    expect(resolveApiErrorMessage(error, { default: 'x', connection: 'Custom connection error.' })).toBe(
      'Custom connection error.'
    );
  });

  it('maps 5xx to a generic server error instead of the caller default', () => {
    const error = errorResponse(500, { message: 'Invalid email or password.' });

    expect(resolveApiErrorMessage(error, { default: 'Invalid email or password.' })).toBe(
      'Something went wrong on our end. Please try again later.'
    );
  });

  it('uses a custom server message when provided', () => {
    const error = errorResponse(503, null);

    expect(resolveApiErrorMessage(error, { default: 'x', server: 'Custom server error.' })).toBe(
      'Custom server error.'
    );
  });
});
