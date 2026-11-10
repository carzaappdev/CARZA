import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anon, cleanup, createUser, type TestUser } from './helpers';

let mod: TestUser;
let author: TestUser;
let viewer: TestUser;

async function post(user: TestUser, body: string) {
  const { data, error } = await user.client.from('posts').insert({ body }).select('id').single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  mod = await createUser('mod');
  author = await createUser('author');
  viewer = await createUser('viewer');
  // Roles aren't client-writable; promote through the secret key like an owner would in SQL.
  const { error } = await admin.from('profiles').update({ role: 'admin' }).eq('id', mod.id);
  if (error) throw error;
});
afterAll(cleanup);

describe('admin tools are admin-only', () => {
  it('refuses everyone else', async () => {
    const id = await post(author, 'my post');
    for (const client of [viewer.client, author.client, anon()]) {
      expect(
        (await client.rpc('admin_remove_content', { p_target_type: 'post', p_target_id: id }))
          .error,
      ).not.toBeNull();
      expect(
        (await client.rpc('admin_set_suspended', { p_user_id: author.id, p_action: 'suspend' }))
          .error,
      ).not.toBeNull();
      expect(
        (await client.rpc('admin_delete_account', { p_user_id: author.id })).error,
      ).not.toBeNull();
    }
    expect((await viewer.client.from('moderation_actions').select('id')).data).toEqual([]);
    expect(
      (await viewer.client.from('moderation_actions').insert({ action: 'suspend' } as never)).error,
    ).not.toBeNull();
    // Nobody can suspend themselves out of trouble or flip the flag directly.
    expect(
      (
        await author.client
          .from('profiles')
          .update({ suspended_at: null } as never)
          .eq('id', author.id)
      ).error,
    ).not.toBeNull();
  });
});

describe('removing content', () => {
  it('takes it down and records it against the owner', async () => {
    const id = await post(author, 'spam spam');
    const { error } = await mod.client.rpc('admin_remove_content', {
      p_target_type: 'post',
      p_target_id: id,
      p_reason: 'spam',
    });
    expect(error).toBeNull();
    expect((await anon().from('posts').select('id').eq('id', id)).data).toEqual([]);
    const { data: log } = await mod.client
      .from('moderation_actions')
      .select('action, target_user_id, target_id, reason, admin_id')
      .eq('target_id', id);
    expect(log).toEqual([
      {
        action: 'remove_content',
        target_user_id: author.id,
        target_id: id,
        reason: 'spam',
        admin_id: mod.id,
      },
    ]);
    // Already gone: no error, no second record.
    expect(
      (await mod.client.rpc('admin_remove_content', { p_target_type: 'post', p_target_id: id }))
        .error,
    ).toBeNull();
    expect(
      (await mod.client.from('moderation_actions').select('id').eq('target_id', id)).data,
    ).toHaveLength(1);
  });
});

describe('suspending an account', () => {
  it('hides the account and everything it posted, signs it out, and can be lifted', async () => {
    const id = await post(author, 'still here');
    const { error } = await mod.client.rpc('admin_set_suspended', {
      p_user_id: author.id,
      p_action: 'suspend',
      p_reason: 'harassment',
    });
    expect(error).toBeNull();

    for (const client of [viewer.client, anon()]) {
      expect((await client.from('posts').select('id').eq('id', id)).data).toEqual([]);
      expect((await client.from('profiles').select('id').eq('id', author.id)).data).toEqual([]);
    }
    // Admins still see it, to review and to lift the suspension.
    expect((await mod.client.from('posts').select('id').eq('id', id)).data).toHaveLength(1);
    expect((await mod.client.from('profiles').select('id').eq('id', author.id)).data).toHaveLength(
      1,
    );
    // Their sessions are gone, so the app can't keep them signed in.
    expect((await author.client.auth.refreshSession()).error).not.toBeNull();

    expect(
      (await mod.client.rpc('admin_set_suspended', { p_user_id: author.id, p_action: 'unsuspend' }))
        .error,
    ).toBeNull();
    expect((await anon().from('posts').select('id').eq('id', id)).data).toHaveLength(1);
    expect((await anon().from('profiles').select('id').eq('id', author.id)).data).toHaveLength(1);
  });

  it("can't be used on admins or on yourself", async () => {
    expect(
      (await mod.client.rpc('admin_set_suspended', { p_user_id: mod.id, p_action: 'suspend' }))
        .error?.code,
    ).toBe('42501');
    expect((await mod.client.rpc('admin_delete_account', { p_user_id: mod.id })).error?.code).toBe(
      '42501',
    );
  });
});

describe('deleting an account', () => {
  it('removes it and keeps a record', async () => {
    const gone = await createUser('gone');
    expect(
      (await mod.client.rpc('admin_delete_account', { p_user_id: gone.id, p_note: 'under 13' }))
        .error,
    ).toBeNull();
    expect((await admin.from('profiles').select('id').eq('id', gone.id)).data).toEqual([]);
    const { data: log } = await mod.client
      .from('moderation_actions')
      .select('action, note')
      .eq('target_user_id', gone.id);
    expect(log).toEqual([{ action: 'delete_account', note: 'under 13' }]);
  });
});

describe('new report reasons', () => {
  it('are accepted', async () => {
    const id = await post(author, 'reported');
    for (const reason of ['copyright', 'child_safety', 'intimate_image'] as const) {
      const reporter = await createUser('reporter');
      expect(
        (
          await reporter.client
            .from('reports')
            .insert({ target_type: 'post', target_id: id, reason })
        ).error,
      ).toBeNull();
    }
  });
});

describe('evidence bucket', () => {
  it('is closed to everyone but the server', async () => {
    const file = new Blob(['x'], { type: 'text/plain' });
    for (const client of [viewer.client, mod.client, anon()]) {
      expect((await client.storage.from('evidence').upload('a/b.txt', file)).error).not.toBeNull();
      expect((await client.storage.from('evidence').list('')).data ?? []).toEqual([]);
    }
  });
});
