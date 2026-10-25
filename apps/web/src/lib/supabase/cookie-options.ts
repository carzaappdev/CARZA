// Session cookies: Secure in production (never sent over plain HTTP). SameSite=Lax is the @supabase/ssr
// default. Not HttpOnly by design: the browser client needs the session for auth calls and Realtime.
export const SESSION_COOKIE_OPTIONS = {
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
} as const;
