const OTPAuth = require('otpauth');
const Admin = require('../../models/Admin');
const {
  PERIOD, encryptSecret, decryptSecret, generateSecret, enrolmentDetails, matchTotp, acceptTotp,
  generateBackupCodes, consumeBackupCode, backupCodesLeft,
} = require('../../services/twoFactor');
const { connectTestDb, clearTestDb, disconnectTestDb, createAdmin } = require('../helpers');

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

const codeAt = (secret, timestamp) => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate({ timestamp });
const stepOf = (timestamp) => Math.floor(timestamp / 1000 / PERIOD);

describe('secret encryption', () => {
  test('round trips and never stores the plain secret', () => {
    const secret = generateSecret();
    const stored = encryptSecret(secret);
    expect(stored).not.toContain(secret);
    expect(decryptSecret(stored)).toBe(secret);
  });

  test('encrypting twice gives different output', () => {
    const secret = generateSecret();
    expect(encryptSecret(secret)).not.toBe(encryptSecret(secret));
  });

  test('a tampered value fails to decrypt', () => {
    const stored = encryptSecret(generateSecret());
    const [iv, tag, data] = stored.split('.');
    const flipped = data[0] === 'A' ? `B${data.slice(1)}` : `A${data.slice(1)}`;
    expect(() => decryptSecret([iv, tag, flipped].join('.'))).toThrow();
  });
});

describe('enrolmentDetails', () => {
  test('returns an otpauth url with the issuer and email, and a QR image', async () => {
    const secret = generateSecret();
    const details = await enrolmentDetails(secret, 'jane@uniguide.cm');
    expect(details.secret).toBe(secret);
    expect(details.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(details.otpauthUrl).toContain('jane%40uniguide.cm');
    expect(details.otpauthUrl).toContain('issuer=UniGuide%20Cameroon');
    expect(details.qr).toMatch(/^data:image\/png;base64,/);
  });
});

describe('matchTotp', () => {
  const secret = generateSecret();
  const now = Date.now();

  test('accepts the current code and returns its step', () => {
    expect(matchTotp(secret, codeAt(secret, now), now)).toBe(stepOf(now));
  });

  test('accepts one step either side for clock drift', () => {
    expect(matchTotp(secret, codeAt(secret, now - PERIOD * 1000), now)).toBe(stepOf(now) - 1);
    expect(matchTotp(secret, codeAt(secret, now + PERIOD * 1000), now)).toBe(stepOf(now) + 1);
  });

  test('rejects codes further away', () => {
    expect(matchTotp(secret, codeAt(secret, now - 3 * PERIOD * 1000), now)).toBeNull();
  });

  test('ignores spaces but rejects anything that is not six digits', () => {
    const code = codeAt(secret, now);
    expect(matchTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, now)).toBe(stepOf(now));
    expect(matchTotp(secret, '12345', now)).toBeNull();
    expect(matchTotp(secret, 'abcdef', now)).toBeNull();
    expect(matchTotp(secret, { $ne: '' }, now)).toBeNull();
    expect(matchTotp(secret, undefined, now)).toBeNull();
  });
});

describe('acceptTotp', () => {
  test('a code works once, later codes still work', async () => {
    const secret = generateSecret();
    const admin = await createAdmin({ twoFactorEnabled: true, twoFactorSecret: encryptSecret(secret) });
    const now = Date.now();

    expect(await acceptTotp(admin._id, admin.twoFactorSecret, codeAt(secret, now), now)).toBe(true);
    expect(await acceptTotp(admin._id, admin.twoFactorSecret, codeAt(secret, now), now)).toBe(false);
    // An older code from the drift window is a replay too
    expect(await acceptTotp(admin._id, admin.twoFactorSecret, codeAt(secret, now - PERIOD * 1000), now)).toBe(false);

    const later = now + PERIOD * 1000;
    expect(await acceptTotp(admin._id, admin.twoFactorSecret, codeAt(secret, later), later)).toBe(true);
    expect((await Admin.findById(admin._id)).lastTotpStep).toBe(stepOf(later));
  });

  test('the same code sent twice at once only works once', async () => {
    const secret = generateSecret();
    const admin = await createAdmin({ twoFactorEnabled: true, twoFactorSecret: encryptSecret(secret) });
    const now = Date.now();
    const code = codeAt(secret, now);

    const results = await Promise.all([1, 2, 3].map(() => acceptTotp(admin._id, admin.twoFactorSecret, code, now)));
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  test('a wrong code is rejected', async () => {
    const secret = generateSecret();
    const admin = await createAdmin({ twoFactorEnabled: true, twoFactorSecret: encryptSecret(secret) });
    expect(await acceptTotp(admin._id, admin.twoFactorSecret, codeAt(generateSecret(), Date.now()))).toBe(false);
  });
});

describe('backup codes', () => {
  test('generates the configured number of unique codes and stores only hashes', () => {
    const { codes, stored } = generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    codes.forEach((code) => expect(code).toMatch(/^[a-z0-9]{5}-[a-z0-9]{5}$/));
    expect(JSON.stringify(stored)).not.toContain(codes[0].replace('-', ''));
    stored.forEach((entry) => expect(entry).toEqual({ hash: expect.stringMatching(/^[0-9a-f]{64}$/), usedAt: null }));
  });

  test('each code works once, whatever its casing or dashes', async () => {
    const { codes, stored } = generateBackupCodes();
    const admin = await createAdmin({ twoFactorEnabled: true, backupCodes: stored });

    expect(await consumeBackupCode(admin._id, codes[0].toUpperCase().replace('-', ' '))).toBe(true);
    expect(await consumeBackupCode(admin._id, codes[0])).toBe(false);
    expect(await consumeBackupCode(admin._id, codes[1])).toBe(true);
    expect(await backupCodesLeft(admin._id)).toBe(8);
  });

  test('unknown or malformed codes are rejected', async () => {
    const { stored } = generateBackupCodes();
    const admin = await createAdmin({ twoFactorEnabled: true, backupCodes: stored });

    expect(await consumeBackupCode(admin._id, 'aaaaa-aaaaa')).toBe(false);
    expect(await consumeBackupCode(admin._id, '123')).toBe(false);
    expect(await consumeBackupCode(admin._id, { $ne: null })).toBe(false);
    expect(await backupCodesLeft(admin._id)).toBe(10);
  });

  test('the same code sent twice at once only works once', async () => {
    const { codes, stored } = generateBackupCodes();
    const admin = await createAdmin({ twoFactorEnabled: true, backupCodes: stored });

    const results = await Promise.all([1, 2, 3].map(() => consumeBackupCode(admin._id, codes[0])));
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
