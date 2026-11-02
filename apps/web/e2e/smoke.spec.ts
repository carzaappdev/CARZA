import { expect, test, type Page } from '@playwright/test';

// Accounts from supabase/seed.sql. They exist only in the local stack.
const PASSWORD = 'password1234';

async function signIn(page: Page, email: string) {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/welcome');
  // Seed accounts haven't done first-run setup yet; skip through it the first time.
  if (new URL(page.url()).pathname === '/welcome') {
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await page.getByRole('button', { name: 'Start exploring' }).click();
    await page.waitForURL((url) => url.pathname === '/');
  }
}

test('a visitor can browse the feed, reels and events', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Cars and coffee this Saturday at 8')).toBeVisible();

  await page
    .getByRole('link', { name: 'Events', exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByText('Hill Country Cruise').first()).toBeVisible();

  const reels = await page.goto('/reels');
  expect(reels?.status()).toBe(200);
});

test('parked marketplace pages are hidden', async ({ request }) => {
  for (const path of ['/search', '/listings', '/dealers']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test('signed-out visitors are sent to sign in', async ({ page }) => {
  await page.goto('/notifications');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fnotifications$/);
});

test('a member can sign in and post to the feed', async ({ page }) => {
  await signIn(page, 'buyer1@carza.test');
  const body = `Smoke test post ${Date.now()}`;
  await page.getByPlaceholder('What’s new in your garage?').fill(body);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByText(body)).toBeVisible();
});

test('a member can RSVP to an event and change their mind', async ({ page }) => {
  await signIn(page, 'buyer2@carza.test');
  await page.goto('/events');
  await page
    .getByRole('link', { name: /Detailing Night/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/events\/[^/]+$/);

  const rsvp = page.getByRole('button', { name: /^(RSVP|Going)$/ });
  const before = await rsvp.getAttribute('aria-pressed');
  const after = before === 'true' ? 'false' : 'true';
  await rsvp.click();
  await expect(rsvp).toHaveAttribute('aria-pressed', after);
  // Put it back so reruns start from the same state.
  await rsvp.click();
  await expect(rsvp).toHaveAttribute('aria-pressed', before ?? 'false');
});
