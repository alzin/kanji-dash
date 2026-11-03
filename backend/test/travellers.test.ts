import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import type { AuthService } from '../src/application/auth-service.js';
import type { GoogleProvider } from '../src/application/auth-ports.js';
import type { SessionRecord, TravellerRepository } from '../src/application/ports.js';
import type { ProgressService } from '../src/application/progress-service.js';
import { TravellerService, parseTravellerReport } from '../src/application/traveller-service.js';
import type { Config } from '../src/config.js';
import { CHAPTER_IDS } from '../src/domain/curriculum.js';
import { AppError } from '../src/domain/errors.js';
import { MAX_TRAVELLERS, mapName, type TravellerReport, type TravellerRow } from '../src/domain/travellers.js';
import { createApp } from '../src/interfaces/http/app.js';

const config: Config = {
  NODE_ENV: 'test', PORT: 3001, HOST: '127.0.0.1', DATABASE_URL: 'postgresql://test:test@localhost/test',
  FRONTEND_URL: 'http://localhost:5173/', GOOGLE_CLIENT_ID: 'test.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'test',
  GOOGLE_REDIRECT_URI: 'http://localhost:5173/api/auth/google/callback', COOKIE_SECRET: 'a-test-secret-with-at-least-thirty-two-characters',
  COOKIE_SAME_SITE: 'lax', SESSION_DAYS: 30, TRUST_PROXY_HOPS: 0,
};
const origin = new URL(config.FRONTEND_URL).origin;

class MemoryTravellers implements TravellerRepository {
  readonly rows = new Map<string, TravellerRow>();
  queries = 0;
  constructor(private readonly names: Record<string, string>, private readonly now: () => Date) {}
  async report(userId: string, report: TravellerReport) {
    const previous = this.rows.get(userId);
    this.rows.set(userId, { userId, name: this.names[userId]!, stop: report.stop, seals: report.seals,
      anonymous: report.anonymous ?? previous?.anonymous ?? false, seenAt: this.now() });
  }
  async recent(since: Date, limit: number) {
    this.queries += 1;
    return [...this.rows.values()].filter((row) => row.seenAt > since).sort((a, b) => b.seenAt.getTime() - a.seenAt.getTime()).slice(0, limit);
  }
}

function harness() {
  let now = new Date('2026-11-03T10:00:00Z');
  const clock = () => now;
  const repository = new MemoryTravellers({ alice: 'Alice Wonderland', bob: 'Bob', chiyo: '  千代 子 ' }, clock);
  const service = new TravellerService(repository, clock);
  const sessions: Record<string, SessionRecord> = Object.fromEntries(['alice', 'bob'].map((id) => [`${id}-token`.padEnd(43, 'x'), {
    user: { id, email: `${id}@example.com`, name: id, picture: null }, csrfToken: `csrf-${id}`, expiresAt: new Date('2027-01-01'),
  }]));
  const auth = { session: async (token?: string) => (token && sessions[token]) || null } as unknown as AuthService;
  const app = createApp({ config, auth, google: {} as GoogleProvider, progress: {} as ProgressService, travellers: service, ready: async () => {} });
  const as = (id: string) => ({ cookie: `kq_session=${`${id}-token`.padEnd(43, 'x')}`, csrf: `csrf-${id}` });
  const report = (id: string, body: unknown) => request(app).put('/api/travellers/me').set('Cookie', as(id).cookie)
    .set('Origin', origin).set('X-CSRF-Token', as(id).csrf).send(body as object);
  return { app, repository, report, as, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}

test('map names keep only the first word of a display name', () => {
  assert.equal(mapName('Alice Wonderland'), 'Alice');
  assert.equal(mapName('  千代 子 '), '千代');
  assert.equal(mapName('Maximilianoooooo Smith'), 'Maximilianoo');
  assert.equal(mapName('   '), null);
});

test('reports accept a real stop and a seal count, and nothing else', () => {
  assert.deepEqual(parseTravellerReport({ stop: 13, seals: 4 }), { stop: 13, seals: 4 });
  assert.deepEqual(parseTravellerReport({ stop: 1, seals: 0, anonymous: true }), { stop: 1, seals: 0, anonymous: true });
  for (const value of [null, [], {}, { stop: 0, seals: 0 }, { stop: 999, seals: 0 }, { stop: 1.5, seals: 0 }, { stop: '1', seals: 0 },
    { stop: 1, seals: -1 }, { stop: 1, seals: CHAPTER_IDS.length + 1 }, { stop: 1, seals: 0.5 }, { stop: 1, seals: 0, anonymous: 'yes' },
    { stop: 1, seals: 0, name: 'Mallory' }]) {
    assert.throws(() => parseTravellerReport(value), (error: unknown) => error instanceof AppError && error.code === 'INVALID_TRAVELLER');
  }
});

test('without the service the shared map reports itself unavailable', async () => {
  const app = createApp({ config, auth: { session: async () => null } as unknown as AuthService, google: {} as GoogleProvider, progress: {} as ProgressService, ready: async () => {} });
  await request(app).get('/api/travellers').expect(503);
});

test('signed-in learners report from the map; anyone sees them, but never themselves or their account', async () => {
  const { app, report, as, advance } = harness();
  await request(app).put('/api/travellers/me').send({ stop: 1, seals: 0 }).expect(401);
  await request(app).put('/api/travellers/me').set('Cookie', as('alice').cookie).set('Origin', origin).send({ stop: 1, seals: 0 }).expect(403);
  await report('alice', { stop: 999, seals: 0 }).expect(400);
  await report('alice', { stop: 14, seals: 13 }).expect(204);
  advance(3 * 60_000);
  await report('bob', { stop: 2, seals: 1 }).expect(204);
  advance(10_000);

  const guest = await request(app).get('/api/travellers').expect(200);
  assert.equal(guest.body.me, null);
  assert.deepEqual(guest.body.travellers.map(({ id: _id, ...rest }: { id: string }) => rest), [
    { name: 'Bob', stop: 2, seals: 1, online: true },
    { name: 'Alice', stop: 14, seals: 13, online: false },
  ]);
  const ids = guest.body.travellers.map((t: { id: string }) => t.id);
  assert.ok(ids.every((id: string) => /^[A-Za-z0-9_-]{12}$/.test(id) && !['alice', 'bob'].includes(id)));
  assert.doesNotMatch(JSON.stringify(guest.body), /example\.com|Wonderland|alice|bob/);

  advance(10_000);
  const alice = await request(app).get('/api/travellers').set('Cookie', as('alice').cookie).expect(200);
  assert.deepEqual(alice.body.me, { anonymous: false });
  assert.deepEqual(alice.body.travellers.map((t: { name: string }) => t.name), ['Bob'], 'A learner is drawn by their own map, not the feed.');
});

test('a traveller can walk anonymously, and the choice outlives later reports', async () => {
  const { app, report, as, advance } = harness();
  await report('alice', { stop: 14, seals: 13, anonymous: true }).expect(204);
  await report('alice', { stop: 15, seals: 14 }).expect(204);
  advance(10_000);
  const seen = await request(app).get('/api/travellers').set('Cookie', as('bob').cookie).expect(200);
  assert.deepEqual(seen.body.travellers.map(({ id: _id, ...rest }: { id: string }) => rest), [{ name: null, stop: 15, seals: 14, online: true }]);
  assert.deepEqual((await request(app).get('/api/travellers').set('Cookie', as('alice').cookie)).body.me, { anonymous: true });
  await report('alice', { stop: 15, seals: 14, anonymous: false }).expect(204);
  assert.deepEqual((await request(app).get('/api/travellers').set('Cookie', as('alice').cookie)).body.me, { anonymous: false }, 'Changing the choice is seen at once.');
});

test('every map polling within a few seconds shares one query, and quiet travellers drop off', async () => {
  const { app, repository, report, advance } = harness();
  await report('alice', { stop: 3, seals: 2 }).expect(204);
  advance(10_000);
  await Promise.all(Array.from({ length: 5 }, () => request(app).get('/api/travellers').expect(200)));
  assert.equal(repository.queries, 1);
  advance(5_000);
  await request(app).get('/api/travellers').expect(200);
  assert.equal(repository.queries, 2);
  advance(15 * 86_400_000);
  assert.deepEqual((await request(app).get('/api/travellers').expect(200)).body.travellers, []);
});

test('the feed is capped so a crowded road stays a small download', async () => {
  let now = new Date('2026-11-03T10:00:00Z');
  const names = Object.fromEntries(Array.from({ length: MAX_TRAVELLERS + 20 }, (_, i) => [`u${i}`, `Learner ${i}`]));
  const repository = new MemoryTravellers(names, () => now);
  for (const id of Object.keys(names)) { await repository.report(id, { stop: 1, seals: 0 }); now = new Date(now.getTime() + 1000); }
  const service = new TravellerService(repository, () => now);
  const { travellers } = await service.list('u0');
  assert.equal(travellers.length, MAX_TRAVELLERS);
  assert.equal(travellers[0]!.name, `Learner`, 'The most recently seen come first.');
});
