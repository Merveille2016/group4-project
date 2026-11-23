const { normalizeEmail, validatePassword, validateName } = require('../../services/validation');

describe('normalizeEmail', () => {
  test('trims and lowercases', () => {
    expect(normalizeEmail('  Jane.Doe@UniGuide.CM ')).toBe('jane.doe@uniguide.cm');
  });

  test.each([
    ['not an email', 'jane'],
    ['missing domain dot', 'jane@uniguide'],
    ['contains a space', 'jane doe@uniguide.cm'],
    ['empty', '   '],
    ['too long', `${'a'.repeat(250)}@x.cm`],
  ])('rejects %s', (_label, value) => {
    expect(normalizeEmail(value)).toBeNull();
  });

  test.each([
    ['a query operator object', { $ne: '' }],
    ['an array', ['a@b.cm']],
    ['a number', 42],
    ['null', null],
  ])('rejects %s (blocks NoSQL injection)', (_label, value) => {
    expect(normalizeEmail(value)).toBeNull();
  });
});

describe('validatePassword', () => {
  test('accepts 8 to 128 characters with no composition rules', () => {
    expect(validatePassword('abcdefgh')).toBeNull();
    expect(validatePassword('a'.repeat(128))).toBeNull();
    expect(validatePassword('correct horse battery staple')).toBeNull();
  });

  test('rejects passwords that are too short or too long', () => {
    expect(validatePassword('abcdefg')).toMatch(/at least 8/);
    expect(validatePassword('a'.repeat(129))).toMatch(/at most 128/);
  });

  test('rejects missing and non-string passwords', () => {
    expect(validatePassword('')).toBe('Password is required');
    expect(validatePassword(undefined)).toBe('Password is required');
    expect(validatePassword({ $gt: '' })).toBe('Password is required');
  });
});

describe('validateName', () => {
  test('requires a non-blank name of at most 100 characters', () => {
    expect(validateName('Jane')).toBeNull();
    expect(validateName('   ')).toBe('Name is required');
    expect(validateName(undefined)).toBe('Name is required');
    expect(validateName('x'.repeat(101))).toMatch(/at most 100/);
  });
});
