/** Cookie that remembers who invited you until you've signed up. */
export const INVITE_COOKIE = 'carza_ref';
export const validUsername = (u: string) => /^[a-z0-9_]{3,30}$/.test(u);
