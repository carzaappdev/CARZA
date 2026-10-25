import { ZIP_CODE } from '@carza/shared';

/**
 * The buyer's last searched ZIP code, remembered so the next search and the home page start near them.
 * Set by the filter form in the browser. A ZIP code isn't sensitive, and the cookie is never trusted for
 * anything but a default.
 */
export const ZIP_COOKIE = 'carza_zip';

/** The remembered ZIP code, if the cookie holds a well-formed one. */
export const validZip = (value: string | undefined) =>
  value && ZIP_CODE.test(value) ? value : undefined;
