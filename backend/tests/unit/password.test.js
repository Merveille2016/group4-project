const argon2 = require('argon2');
const bcrypt = require('bcrypt');
const { hashPassword, verifyPassword, spendVerifyTime, isBcryptHash, ARGON2_OPTIONS } = require('../../services/password');

describe('password hashing (argon2id)', () => {
  test('produces an argon2id hash with the configured cost settings', async () => {
    const hash = await hashPassword('s3cret-password');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  test('salts every hash, so the same password hashes differently', async () => {
    const [a, b] = await Promise.all([hashPassword('same-password'), hashPassword('same-password')]);
    expect(a).not.toBe(b);
  });

  test('accepts the right password and needs no rehash', async () => {
    const hash = await hashPassword('s3cret-password');
    await expect(verifyPassword(hash, 's3cret-password')).resolves.toEqual({ ok: true, needsRehash: false });
  });

  test('rejects a wrong password', async () => {
    const hash = await hashPassword('s3cret-password');
    await expect(verifyPassword(hash, 'S3cret-password')).resolves.toEqual({ ok: false, needsRehash: false });
  });

  test('asks for a rehash when the argon2 hash used weaker settings', async () => {
    const weak = await argon2.hash('s3cret-password', { ...ARGON2_OPTIONS, memoryCost: 4096, timeCost: 1 });
    await expect(verifyPassword(weak, 's3cret-password')).resolves.toEqual({ ok: true, needsRehash: true });
  });
});

describe('legacy bcrypt hashes', () => {
  test('are recognised', async () => {
    expect(isBcryptHash(await bcrypt.hash('x', 4))).toBe(true);
    expect(isBcryptHash(await hashPassword('x'))).toBe(false);
  });

  test('still verify, and are flagged for upgrade to argon2', async () => {
    const legacy = await bcrypt.hash('old-password', 4);
    await expect(verifyPassword(legacy, 'old-password')).resolves.toEqual({ ok: true, needsRehash: true });
  });

  test('reject a wrong password without asking for a rehash', async () => {
    const legacy = await bcrypt.hash('old-password', 4);
    await expect(verifyPassword(legacy, 'wrong-password')).resolves.toEqual({ ok: false, needsRehash: false });
  });
});

describe('bad input never throws', () => {
  test.each([
    ['a malformed hash', 'not-a-hash', 'pw'],
    ['a missing hash', undefined, 'pw'],
    ['a non-string password', '$argon2id$v=19$m=19456,t=2,p=1$abc$def', { $gt: '' }],
  ])('%s counts as a wrong password', async (_label, hash, plain) => {
    await expect(verifyPassword(hash, plain)).resolves.toEqual({ ok: false, needsRehash: false });
  });

  test('spendVerifyTime runs an argon2 verify and resolves', async () => {
    const spy = jest.spyOn(argon2, 'verify');
    await spendVerifyTime('anything');
    await spendVerifyTime(undefined);
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
