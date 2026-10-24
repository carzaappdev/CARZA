import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, createListing, createUser, type TestUser } from './helpers';

let reporter: TestUser;
let seller: TestUser;

beforeAll(async () => {
  [reporter, seller] = await Promise.all([createUser('reporter'), createUser('rseller')]);
});
afterAll(cleanup);

describe('reports', () => {
  it('snapshot the reported content and only the reporter (or an admin) can read them', async () => {
    const { listingId } = await createListing(seller);
    const { error } = await reporter.client.from('reports').insert({
      target_type: 'listing',
      target_id: listingId,
      reason: 'scam',
      details: 'Asked for gift cards',
    });
    expect(error).toBeNull();

    const { data } = await reporter.client
      .from('reports')
      .select('target_snapshot, status')
      .eq('target_id', listingId)
      .single();
    expect(data?.status).toBe('open');
    expect((data?.target_snapshot as { price_cents: number }).price_cents).toBe(1_500_000);
    expect(
      (await seller.client.from('reports').select('*').eq('target_id', listingId)).data,
    ).toEqual([]);
  });

  it("can't target content the reporter can't see", async () => {
    const { listingId } = await createListing(seller, { status: 'draft' });
    const { error } = await reporter.client
      .from('reports')
      .insert({ target_type: 'listing', target_id: listingId, reason: 'spam' });
    expect(error?.code).toBe('42501');
  });

  it("reporters can't resolve their own reports", async () => {
    const { listingId } = await createListing(seller);
    await reporter.client
      .from('reports')
      .insert({ target_type: 'listing', target_id: listingId, reason: 'spam' });
    const { data } = await reporter.client
      .from('reports')
      .update({ status: 'resolved' })
      .eq('target_id', listingId)
      .select();
    expect(data).toEqual([]);
  });
});

describe('rate limits (enforced in the database)', () => {
  it('cap messages per minute even when calling the API directly', async () => {
    const { listingId } = await createListing(seller);
    const { data: convId } = await reporter.client.rpc('start_conversation', {
      p_listing_id: listingId,
      p_body: 'hi',
    });
    let lastError: { code?: string } | null = null;
    for (let i = 0; i < 31 && !lastError; i++) {
      const { error } = await reporter.client
        .from('messages')
        .insert({ conversation_id: convId!, body: `msg ${i}` });
      lastError = error;
    }
    expect(lastError?.code).toBe('CZ429');
  });

  it('cap private listing creation per day', async () => {
    const prolific = await createUser('prolific');
    const results: (string | undefined)[] = [];
    for (let i = 0; i < 11; i++) {
      results.push(
        await createListing(prolific).then(
          () => undefined,
          (e: { code?: string }) => e.code,
        ),
      );
    }
    expect(results.slice(0, 10).every((r) => r === undefined)).toBe(true);
    expect(results[10]).toBe('CZ429');
  });
});
