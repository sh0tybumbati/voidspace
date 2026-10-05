import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { disconnect, makePost, makeSpace, makeUser, resetDb, startServer, type TestServer } from './helpers';

let s: TestServer;
let prisma: typeof import('../src/db').prisma;
let outbox: typeof import('../src/lib/mailer').outbox;
let checkConfig: typeof import('../src/lib/config').checkConfig;
let checkPasswordStrength: typeof import('../src/lib/passwords').checkPasswordStrength;

before(async () => {
  s = await startServer(); ({ prisma } = await import('../src/db'));
  ({ outbox } = await import('../src/lib/mailer')); ({ checkConfig } = await import('../src/lib/config')); ({ checkPasswordStrength } = await import('../src/lib/passwords'));
  await resetDb();
});
after(async () => { await s.close(); await disconnect(); });

const PW = 'Passw0rd!test-9';
const lastLink = (to: string, path: string) => {
  const mail = [...outbox].reverse().find((m) => m.to === to);
  return mail?.text.match(new RegExp(`${path}\\?token=([a-f0-9]+)`))?.[1];
};

describe('email verification', () => {
  it('registration emails a one-time link that verifies the address', async () => {
    const u = await makeUser(s, 'everify');
    const token = lastLink('everify@example.test', '/verify-email');
    assert.ok(token, 'a verification email was sent');
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).emailVerifiedAt, null);
    assert.equal((await s.call('POST', '/api/auth/verify-email', { body: { token: 'f'.repeat(64) } })).status, 400);
    assert.equal((await s.call('POST', '/api/auth/verify-email', { body: { token } })).status, 200);
    assert.ok((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).emailVerifiedAt);
    assert.equal((await s.call('POST', '/api/auth/verify-email', { body: { token } })).status, 400, 'single use');
    assert.equal((await s.call('POST', '/api/auth/resend-verification', { token: u.token })).status, 400, 'already verified');
  });

  it('expired links are refused, and resends are limited', async () => {
    const u = await makeUser(s, 'eexpire');
    const token = lastLink('eexpire@example.test', '/verify-email')!;
    await prisma.authToken.updateMany({ where: { userId: u.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await s.call('POST', '/api/auth/verify-email', { body: { token } })).status, 400);
    assert.equal((await s.call('POST', '/api/auth/resend-verification', { token: u.token })).status, 200);
    assert.equal((await s.call('POST', '/api/auth/resend-verification', { token: u.token })).status, 200);
    assert.equal((await s.call('POST', '/api/auth/resend-verification', { token: u.token })).status, 429, 'three links in an hour is the limit');
  });

  it('when required, unverified accounts can read but not write', async () => {
    process.env.REQUIRE_EMAIL_VERIFICATION = '1';
    try {
      const owner = await makeUser(s, 'ewriter'); const space = await makeSpace(s, owner, 'verifyspace').catch(() => null);
      assert.equal(space, null, 'creating a space needs a verified email');
      const blocked = await s.call('POST', '/api/spaces', { token: owner.token, body: { name: 'verifyspace', displayName: 'Verify' } });
      assert.equal(blocked.status, 403);
      assert.equal(blocked.json.code, 'email_unverified');
      assert.equal((await s.call('GET', '/api/posts')).status, 200, 'reading is open');
      assert.equal((await s.call('GET', '/api/auth/me', { token: owner.token })).status, 200);

      await s.call('POST', '/api/auth/verify-email', { body: { token: lastLink('ewriter@example.test', '/verify-email') } });
      const ok = await s.call('POST', '/api/spaces', { token: owner.token, body: { name: 'verifyspace', displayName: 'Verify' } });
      assert.equal(ok.status, 201);
    } finally { delete process.env.REQUIRE_EMAIL_VERIFICATION; }
  });
});

describe('passwords', () => {
  it('weak and guessable passwords are refused at registration', async () => {
    const reg = (username: string, password: string) => s.call('POST', '/api/auth/register', { body: { username, email: `${username}@example.test`, password } });
    assert.equal((await reg('pwuser1', 'short')).status, 400);
    assert.equal((await reg('pwuser2', 'password123')).status, 400);
    assert.equal((await reg('pwuser3', 'aaaaaaaaaa')).status, 400);
    const withName = await reg('pwuser4', 'xx-pwuser4-xx-1');
    assert.equal(withName.status, 400);
    assert.match(withName.json.message, /username/);
    assert.equal((await reg('pwuser5', PW)).status, 201);
    assert.equal(checkPasswordStrength('a-long-unusual-phrase-7'), null);
  });

  it('forgot-password never reveals which emails exist; reset links work once and sign out old sessions', async () => {
    const u = await makeUser(s, 'resetme');
    await new Promise((r) => setTimeout(r, 1100));   // token times are whole seconds
    const before = outbox.length;
    const unknown = await s.call('POST', '/api/auth/forgot-password', { body: { email: 'nobody@example.test' } });
    const known = await s.call('POST', '/api/auth/forgot-password', { body: { email: 'resetme@example.test' } });
    assert.equal(unknown.status, 200); assert.equal(known.status, 200);
    assert.deepEqual(unknown.json, known.json, 'identical answers');
    assert.equal(outbox.length, before + 1, 'only the real account is emailed');

    const token = lastLink('resetme@example.test', '/reset-password')!;
    const weak = await s.call('POST', '/api/auth/reset-password', { body: { token, password: 'password123' } });
    assert.equal(weak.status, 400);
    const strong = await s.call('POST', '/api/auth/reset-password', { body: { token, password: 'a-brand-new-passphrase-42' } });
    assert.equal(strong.status, 200, 'a weak attempt does not burn the link');
    assert.equal((await s.call('POST', '/api/auth/reset-password', { body: { token, password: 'another-passphrase-43' } })).status, 400, 'single use');

    assert.equal((await s.call('GET', '/api/auth/me', { token: u.token })).status, 401, 'the old session is signed out');
    assert.equal((await s.call('POST', '/api/auth/login', { body: { username: 'resetme', password: PW } })).status, 401, 'old password');
    const login = await s.call('POST', '/api/auth/login', { body: { username: 'resetme', password: 'a-brand-new-passphrase-42' } });
    assert.equal(login.status, 200);
    assert.equal((await s.call('GET', '/api/auth/me', { token: login.json.token })).status, 200);
  });

  it('changing your password signs out other sessions and returns a working token', async () => {
    const u = await makeUser(s, 'changer');
    await new Promise((r) => setTimeout(r, 1100));   // token timestamps are whole seconds
    const res = await s.call('PATCH', '/api/auth/password', { token: u.token, body: { currentPassword: PW, newPassword: 'changed-passphrase-77' } });
    assert.equal(res.status, 200);
    assert.ok(res.json.token);
    assert.equal((await s.call('GET', '/api/auth/me', { token: u.token })).status, 401, 'the old token stops working');
    assert.equal((await s.call('GET', '/api/auth/me', { token: res.json.token })).status, 200);
  });
});

describe('rate limits', () => {
  it('repeated failed sign-ins are slowed down', async () => {
    await makeUser(s, 'limited');
    process.env.RATE_LIMIT_DISABLED = '0';
    try {
      const codes: number[] = [];
      for (let i = 0; i < 12; i++) codes.push((await s.call('POST', '/api/auth/login', { body: { username: 'limited', password: 'wrong-password' } })).status);
      assert.equal(codes.slice(0, 10).every((c) => c === 401), true);
      assert.equal(codes[10], 429);
      const limited = await s.call('POST', '/api/auth/login', { body: { username: 'limited', password: PW } });
      assert.equal(limited.status, 429, 'even the right password waits');
      assert.ok(limited.headers.get('ratelimit') || limited.headers.get('retry-after'), 'says when to retry');
    } finally { process.env.RATE_LIMIT_DISABLED = '1'; }
  });
});

describe('startup configuration check', () => {
  const prod = { NODE_ENV: 'production', DATABASE_URL: 'x', FRONTEND_URL: 'https://v.example', JWT_SECRET: 'q'.repeat(40) };
  it('a good production setup passes (with advice)', () => {
    const r = checkConfig(prod);
    assert.deepEqual(r.problems, []);
    assert.ok(r.warnings.some((w) => /SMTP_HOST/.test(w)));
    assert.ok(r.warnings.some((w) => /TRUST_PROXY/.test(w)));
  });
  it('catches missing and example secrets, and impossible email settings', () => {
    assert.ok(checkConfig({ ...prod, JWT_SECRET: undefined }).problems.some((p) => /JWT_SECRET is not set/.test(p)));
    assert.ok(checkConfig({ ...prod, JWT_SECRET: 'short' }).problems.some((p) => /32 characters/.test(p)));
    assert.ok(checkConfig({ ...prod, JWT_SECRET: 'your-secret-key-change-in-production-please' }).problems.some((p) => /example/.test(p)));
    assert.ok(checkConfig({ ...prod, FRONTEND_URL: undefined }).problems.some((p) => /FRONTEND_URL/.test(p)));
    assert.ok(checkConfig({ ...prod, REQUIRE_EMAIL_VERIFICATION: '1' }).problems.some((p) => /SMTP_HOST/.test(p)));
    assert.deepEqual(checkConfig({ NODE_ENV: 'development', DATABASE_URL: 'x', JWT_SECRET: 'dev' }).problems, [], 'development is relaxed');
  });
});
