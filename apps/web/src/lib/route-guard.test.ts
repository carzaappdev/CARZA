import { describe, expect, it } from 'vitest';
import { routeRedirect } from './route-guard';

describe('routeRedirect', () => {
  it('sends signed-out users on protected routes to sign-in with a safe next', () => {
    expect(routeRedirect('/account/listings', '?tab=drafts', false)).toBe(
      '/sign-in?next=%2Faccount%2Flistings%3Ftab%3Ddrafts',
    );
    expect(routeRedirect('/dealer', '', false)).toBe('/sign-in?next=%2Fdealer');
  });

  it('does not treat lookalike paths as protected', () => {
    expect(routeRedirect('/accounting', '', false)).toBeNull();
    expect(routeRedirect('/dealers/some-dealer', '', false)).toBeNull();
  });

  it('lets signed-in users through', () => {
    expect(routeRedirect('/account', '', true)).toBeNull();
  });

  it('never redirects away from sign-in (that could loop with a revoked session)', () => {
    expect(routeRedirect('/sign-in', '?next=/dealer', true)).toBeNull();
    expect(routeRedirect('/sign-in', '', false)).toBeNull();
  });

  it('leaves public routes alone', () => {
    expect(routeRedirect('/', '', false)).toBeNull();
    expect(routeRedirect('/listings/123', '', true)).toBeNull();
  });
});
