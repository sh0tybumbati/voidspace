import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { disconnect, makeSpace, makeUser, resetDb, startServer, type TestServer, type TestUser } from './helpers';

process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'voidspace-uploads-'));   // set before the app mounts /uploads

let s: TestServer;
let prisma: typeof import('../src/db').prisma;
let user: TestUser;
before(async () => { s = await startServer(); ({ prisma } = await import('../src/db')); await resetDb(); user = await makeUser(s, 'uploader'); });
after(async () => { await s.close(); await disconnect(); });

const upload = (body: Buffer | string, type: string, token: string | null = user.token) =>
  fetch(`${s.base}/api/uploads`, { method: 'POST', headers: { 'content-type': type, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body as any })
    .then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) as any }));

const png = (w = 300, h = 200) => sharp({ create: { width: w, height: h, channels: 3, background: '#336699' } }).png().toBuffer();

describe('image uploads', () => {
  it('stores a re-encoded WebP, shrinks big images, and serves it with safe headers', async () => {
    const res = await upload(await png(3000, 2000), 'image/png');
    assert.equal(res.status, 201);
    assert.match(res.json.url, /^\/uploads\/\d{4}\/\d{2}\/[a-f0-9]{40}\.webp$/);
    assert.equal(res.json.width, 2048, 'scaled to fit 2048');
    assert.equal(res.json.height, 1365);
    const file = await fetch(s.base + res.json.url);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'image/webp');
    assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(file.headers.get('cross-origin-resource-policy'), 'cross-origin', 'the web app on another port may embed it');
    assert.match(file.headers.get('cache-control') ?? '', /immutable/);
  });

  it('strips metadata such as GPS location', async () => {
    const withExif = await sharp(await png(200, 200)).jpeg().withExif({ IFD0: { Copyright: 'secret-owner' }, IFD3: { GPSLatitudeRef: 'N' } }).toBuffer();
    assert.ok((await sharp(withExif).metadata()).exif, 'the input really has EXIF');
    const res = await upload(withExif, 'image/jpeg');
    assert.equal(res.status, 201);
    const stored = readFileSync(join(process.env.UPLOAD_DIR!, res.json.url.replace('/uploads/', '')));
    assert.equal((await sharp(stored).metadata()).exif, undefined);
    assert.equal(stored.includes(Buffer.from('secret-owner')), false);
  });

  it('refuses things that are not images, however they are labelled', async () => {
    assert.equal((await upload(await png(), 'image/png', null)).status, 401);
    assert.equal((await upload('plain text', 'text/plain')).status, 415);
    assert.equal((await upload('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'image/svg+xml')).status, 415, 'SVG is never accepted');
    const fake = await upload('<html><script>alert(1)</script></html>', 'image/png');
    assert.equal(fake.status, 400, 'HTML labelled as PNG');
    assert.match(fake.json.message, /not a valid image/);
    assert.equal((await upload(Buffer.alloc(0), 'image/png')).status, 415);
  });

  it('enforces the size and daily limits', async () => {
    const big = Buffer.concat([await png(), Buffer.alloc(6 * 1024 * 1024)]);
    assert.equal((await upload(big, 'image/png')).status, 413);
    const heavy = await makeUser(s, 'heavy');
    await prisma.upload.createMany({ data: Array.from({ length: 20 }, (_, i) => ({ userId: heavy.id, storageKey: `x/${i}`, url: `/uploads/x/${i}`, mime: 'image/webp', bytes: 1, sha256: String(i) })) });
    const over = await upload(await png(), 'image/png', heavy.token);
    assert.equal(over.status, 429);
  });

  it('image posts may only use an image you uploaded; link posts need http(s)', async () => {
    const space = await makeSpace(s, user, 'picspace');
    const other = await makeUser(s, 'otherposter');
    const mine = (await upload(await png(), 'image/png')).json.url;
    const post = (token: string, body: object) => s.call('POST', '/api/posts', { token, body: { spaceId: space.id, title: 'A picture', ...body } });

    assert.equal((await post(user.token, { postType: 'image', url: mine })).status, 201);
    assert.equal((await post(other.token, { postType: 'image', url: mine })).status, 400, 'not your upload');
    assert.equal((await post(user.token, { postType: 'image', url: 'https://tracker.example/pixel.png' })).status, 400, 'no hotlinking');
    assert.equal((await post(user.token, { postType: 'image' })).status, 400);
    assert.equal((await post(user.token, { postType: 'link', url: 'javascript:alert(1)' })).status, 400);
    assert.equal((await post(user.token, { postType: 'link', url: 'https://example.org/article' })).status, 201);
    assert.equal((await post(user.token, { postType: 'video', url: 'https://example.org/v.mp4' })).status, 400);
    const text = await post(user.token, { postType: 'text', content: 'hi', url: 'https://ignored.example' });
    assert.equal(text.status, 201);
    assert.equal(text.json.post.url, null, 'text posts carry no url');
  });

  it('space icon and banner: founders may set their own uploads, nobody else', async () => {
    const space = await makeSpace(s, user, 'artspace');
    const intruder = await makeUser(s, 'artintruder');
    const icon = (await upload(await png(256, 256), 'image/png')).json.url;
    const banner = (await upload(await png(1600, 400), 'image/png')).json.url;
    const patch = (token: string, body: object) => s.call('PATCH', `/api/spaces/${space.name}`, { token, body });

    assert.equal((await patch(user.token, { iconUrl: icon, bannerUrl: banner })).status, 200);
    const got = (await s.call('GET', `/api/spaces/${space.name}`)).json.space;
    assert.equal(got.iconUrl, icon);
    assert.equal(got.bannerUrl, banner);
    assert.equal((await s.call('GET', '/api/spaces?limit=50')).json.spaces.find((x: any) => x.name === space.name).iconUrl, icon, 'lists carry the icon');

    assert.equal((await patch(intruder.token, { iconUrl: icon })).status, 403, 'not a moderator');
    const theirs = (await upload(await png(321, 123), 'image/png', intruder.token)).json.url;
    assert.equal((await patch(user.token, { iconUrl: theirs })).status, 400, 'someone else\'s upload');
    assert.equal((await patch(user.token, { bannerUrl: 'https://tracker.example/x.png' })).status, 400, 'no hotlinking');
    assert.equal((await patch(user.token, { bannerUrl: '/uploads/../../etc/passwd' })).status, 400);

    assert.equal((await patch(user.token, { bannerUrl: null })).status, 200);
    assert.equal((await s.call('GET', `/api/spaces/${space.name}`)).json.space.bannerUrl, null, 'null goes back to the default look');
  });
});
