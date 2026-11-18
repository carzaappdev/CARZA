import 'server-only';
import { createSign } from 'node:crypto';
import { connect } from 'node:http2';
import { serverEnv } from '@/env/server';

/** The iPhone app's bundle ID; APNs only delivers to apps with this topic. */
export const IOS_BUNDLE_ID = 'com.carzaapp.app';
const HOST = 'https://api.push.apple.com';

export type ApnsAlert = { title: string; body: string; url: string; tag: string };

function config() {
  const { APNS_KEY_ID: keyId, APNS_TEAM_ID: teamId, APNS_PRIVATE_KEY: key } = serverEnv;
  return keyId && teamId && key ? { keyId, teamId, key: key.replace(/\\n/g, '\n') } : null;
}

const b64url = (input: string | Buffer) => Buffer.from(input).toString('base64url');

// Apple accepts a provider token for up to an hour and throttles making new ones too often.
let cached: { token: string; at: number } | null = null;
function providerToken(c: NonNullable<ReturnType<typeof config>>) {
  if (cached && Date.now() - cached.at < 45 * 60_000) return cached.token;
  const at = Date.now();
  const unsigned = `${b64url(JSON.stringify({ alg: 'ES256', kid: c.keyId }))}.${b64url(
    JSON.stringify({ iss: c.teamId, iat: Math.floor(at / 1000) }),
  )}`;
  const signature = createSign('SHA256')
    .update(unsigned)
    .sign({ key: c.key, dsaEncoding: 'ieee-p1363' });
  cached = { token: `${unsigned}.${b64url(signature)}`, at };
  return cached.token;
}

/**
 * Sends one alert to each iPhone token. Returns how many were delivered and which tokens Apple says
 * are gone (app deleted, alerts turned off, or signed out), so the caller can forget them.
 * Does nothing (sent 0) when the APNs key isn't configured.
 */
export async function sendApns(tokens: string[], alert: ApnsAlert) {
  const c = config();
  if (!c || !tokens.length) return { sent: 0, gone: [] as string[] };
  const auth = `bearer ${providerToken(c)}`;
  const payload = JSON.stringify({
    aps: {
      alert: { title: alert.title, body: alert.body },
      sound: 'default',
      'thread-id': alert.tag,
    },
    url: alert.url,
  });
  const session = connect(HOST);
  session.on('error', () => {});
  const gone: string[] = [];
  try {
    const results = await Promise.all(
      tokens.map(
        (token) =>
          new Promise<boolean>((resolve) => {
            const req = session.request({
              ':method': 'POST',
              ':path': `/3/device/${token}`,
              authorization: auth,
              'apns-topic': IOS_BUNDLE_ID,
              'apns-push-type': 'alert',
              'apns-priority': '10',
              'apns-expiration': String(Math.floor(Date.now() / 1000) + 24 * 60 * 60),
              'apns-collapse-id': alert.tag.slice(0, 64),
              'content-type': 'application/json',
            });
            let status = 0;
            let body = '';
            req.setEncoding('utf8');
            req.on('response', (headers) => (status = Number(headers[':status'])));
            req.on('data', (chunk: string) => (body += chunk));
            // 'close' fires after success, errors and timeouts alike.
            req.on('close', () => {
              if (
                status === 410 ||
                /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/.test(body)
              ) {
                gone.push(token);
              } else if (status !== 200) {
                console.error('apns delivery failed', { status, reason: body.slice(0, 200) });
              }
              resolve(status === 200);
            });
            req.on('error', () => {});
            req.setTimeout(10_000, () => req.close());
            req.end(payload);
          }),
      ),
    );
    return { sent: results.filter(Boolean).length, gone };
  } finally {
    session.close();
  }
}
