import { describe, it, expect } from 'vitest';
import lib from './registration_lib.js';

const { isTrustedDomain, approvalFor, normalizeEmail } = lib;

describe('isTrustedDomain', () => {
  it('accepts the domain itself, whatever the casing', () => {
    expect(isTrustedDomain('jan@gebauer.koeln', 'gebauer.koeln')).toBe(true);
    expect(isTrustedDomain('  Jan@Gebauer.Koeln ', 'gebauer.koeln')).toBe(true);
    expect(isTrustedDomain('jan@gebauer.koeln', '@gebauer.koeln')).toBe(true);
  });

  it('refuses a domain that merely contains it — the bot case', () => {
    expect(
      isTrustedDomain('bot@gebauer.koeln.example.com', 'gebauer.koeln'),
    ).toBe(false);
    expect(isTrustedDomain('gebauer.koeln@spam.example', 'gebauer.koeln')).toBe(
      false,
    );
    expect(isTrustedDomain('bot@notgebauer.koeln', 'gebauer.koeln')).toBe(
      false,
    );
  });

  it('refuses anything that is not an address', () => {
    expect(isTrustedDomain('gebauer.koeln', 'gebauer.koeln')).toBe(false);
    expect(isTrustedDomain('@gebauer.koeln', 'gebauer.koeln')).toBe(false);
    expect(isTrustedDomain('jan@', 'gebauer.koeln')).toBe(false);
    expect(isTrustedDomain('', 'gebauer.koeln')).toBe(false);
    expect(isTrustedDomain(null, 'gebauer.koeln')).toBe(false);
  });

  it('trusts nobody when no domain is configured', () => {
    expect(isTrustedDomain('jan@gebauer.koeln', '')).toBe(false);
    expect(isTrustedDomain('jan@gebauer.koeln', undefined)).toBe(false);
  });

  it('takes the last @, so a quoted local part cannot smuggle one in', () => {
    expect(
      isTrustedDomain('"a@gebauer.koeln"@spam.example', 'gebauer.koeln'),
    ).toBe(false);
  });
});

describe('approvalFor', () => {
  it('lets the trusted domain in', () => {
    expect(
      approvalFor({ email: 'jan@gebauer.koeln', domain: 'gebauer.koeln' }),
    ).toEqual({ approved: true, reason: 'domain' });
  });

  it('treats an invite as the approval it is', () => {
    expect(
      approvalFor({
        email: 'friend@example.com',
        domain: 'gebauer.koeln',
        invited: true,
      }),
    ).toEqual({ approved: true, reason: 'invited' });
  });

  it('holds everyone else for a yes', () => {
    expect(
      approvalFor({ email: 'bot@example.com', domain: 'gebauer.koeln' }),
    ).toEqual({ approved: false, reason: 'stranger' });
  });
});

describe('normalizeEmail', () => {
  it('trims and lowers', () => {
    expect(normalizeEmail('  JAN@Gebauer.Koeln  ')).toBe('jan@gebauer.koeln');
    expect(normalizeEmail(undefined)).toBe('');
  });
});
