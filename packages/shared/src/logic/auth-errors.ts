/**
 * Maps Supabase Auth error codes to safe, friendly copy. Unknown codes get a generic message:
 * we never show raw provider/server error text to users.
 */
const MESSAGES = new Map<string, string>(
  Object.entries({
    invalid_credentials: 'That email and password don’t match.',
    email_not_confirmed: 'Confirm your email first. Check your inbox for the link.',
    user_already_exists: 'An account with this email already exists. Try signing in.',
    // Also returned when leaked-password protection finds the password in a known breach.
    weak_password:
      'That password is too easy to guess or has appeared in a data breach. Choose a different one.',
    same_password: 'Your new password must be different from the old one.',
    over_request_rate_limit: 'Too many attempts. Wait a minute and try again.',
    over_email_send_rate_limit: 'Too many emails sent. Wait a few minutes and try again.',
    reauthentication_needed: 'For your security, sign in again before changing your password.',
    otp_expired: 'That link has expired or was already used. Request a new one.',
    flow_state_expired: 'That sign-in took too long. Please try again.',
    session_not_found: 'Your session expired. Please sign in again.',
    oauth_failed: 'We couldn’t sign you in with that provider. Please try again.',
    email_address_invalid: 'That email address can’t receive mail. Check it and try again.',
    signup_disabled: 'New sign-ups are paused right now. Please try again later.',
    provider_disabled: 'That sign-in option isn’t available yet. Use email instead.',
    email_confirmed: 'Your email is confirmed. Sign in to finish setting up your account.',
    link_invalid: 'That link is invalid or has expired. Request a new one.',
  }),
);

export const GENERIC_AUTH_ERROR = 'Something went wrong. Please try again.';

export function authErrorMessage(code: string | null | undefined): string {
  return (code && MESSAGES.get(code)) || GENERIC_AUTH_ERROR;
}

/** Codes our own routes put in `?error=` (allow-listed so the URL can't inject arbitrary text). */
export const AUTH_ERROR_CODES = [...MESSAGES.keys()];
