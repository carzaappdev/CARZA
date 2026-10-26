/**
 * The only shape a Server Action ever returns to the client.
 * Errors are data, never thrown, and never contain stack traces or SQL.
 */
export const ERROR_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'VALIDATION',
  'NOT_FOUND',
  'RATE_LIMITED',
  'CONFLICT',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ActionError = {
  code: ErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const fail = (
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> => ({
  ok: false,
  error: fieldErrors ? { code, message, fieldErrors } : { code, message },
});
