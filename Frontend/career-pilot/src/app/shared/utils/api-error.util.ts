import { HttpErrorResponse } from '@angular/common/http';

export interface ApiErrorMessages {
  /** Used for expected 4xx business errors when the response has no body message of its own. */
  default: string;
  /** status 0: the request never reached the server - CORS block, DNS failure, offline, etc. */
  connection?: string;
  /** 5xx: the server received the request but failed to handle it. */
  server?: string;
}

const DEFAULT_CONNECTION_MESSAGE = 'Unable to connect to the server. Please try again.';
const DEFAULT_SERVER_MESSAGE = 'Something went wrong on our end. Please try again later.';

/**
 * A status of 0 means the browser never got an HTTP response at all (CORS rejection, DNS
 * failure, offline, etc.) - `error.error` is an opaque ProgressEvent, not the API's JSON body, so
 * it must never be read as a message. 5xx means the server did respond, but with a failure that
 * has nothing to do with what the user typed, so it shouldn't produce the same message as a 4xx
 * business error like bad credentials.
 */
export function resolveApiErrorMessage(error: HttpErrorResponse, messages: ApiErrorMessages): string {
  if (error.status === 0) {
    return messages.connection ?? DEFAULT_CONNECTION_MESSAGE;
  }

  if (error.status >= 500) {
    return messages.server ?? DEFAULT_SERVER_MESSAGE;
  }

  return (error.error?.message as string | undefined) ?? messages.default;
}
