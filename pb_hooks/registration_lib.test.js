import { describe, it, expect } from 'vitest';
import lib from './registration_lib.js';

const { isTrustedDomain, approvalFor, normalizeEmail } = lib;

describe('isTrustedDomain', () => {
  it('accepts the domain itself, whatever the casing', () => {
    expect(isTrustedDomain('owner@trusted.example', 'trusted.example')).toBe(
      true,
    );
    expect(isTrustedDomain('  Owner@Trusted.Example ', 'trusted.example')).toBe(
      true,
    );
    expect(isTrustedDomain('owner@trusted.example', '@trusted.example')).toBe(
      true,
    );
  });

  it('refuses a domain that merely contains it — the bot case', () => {
    expect(
      isTrustedDomain('bot@trusted.example.example.com', 'trusted.example'),
    ).toBe(false);
    expect(
      isTrustedDomain('trusted.example@spam.example', 'trusted.example'),
    ).toBe(false);
    expect(isTrustedDomain('bot@nottrusted.example', 'trusted.example')).toBe(
      false,
    );
  });

  it('refuses anything that is not an address', () => {
    expect(isTrustedDomain('trusted.example', 'trusted.example')).toBe(false);
    expect(isTrustedDomain('@trusted.example', 'trusted.example')).toBe(false);
    expect(isTrustedDomain('owner@', 'trusted.example')).toBe(false);
    expect(isTrustedDomain('', 'trusted.example')).toBe(false);
    expect(isTrustedDomain(null, 'trusted.example')).toBe(false);
  });

  it('trusts nobody when no domain is configured', () => {
    expect(isTrustedDomain('owner@trusted.example', '')).toBe(false);
    expect(isTrustedDomain('owner@trusted.example', undefined)).toBe(false);
  });

  it('takes the last @, so a quoted local part cannot smuggle one in', () => {
    expect(
      isTrustedDomain('"a@trusted.example"@spam.example', 'trusted.example'),
    ).toBe(false);
  });
});

describe('approvalFor', () => {
  it('lets the trusted domain in', () => {
    expect(
      approvalFor({
        email: 'owner@trusted.example',
        domain: 'trusted.example',
      }),
    ).toEqual({ approved: true, reason: 'domain' });
  });

  it('treats an invite as the approval it is', () => {
    expect(
      approvalFor({
        email: 'friend@example.com',
        domain: 'trusted.example',
        invited: true,
      }),
    ).toEqual({ approved: true, reason: 'invited' });
  });

  it('holds everyone else for a yes', () => {
    expect(
      approvalFor({ email: 'bot@example.com', domain: 'trusted.example' }),
    ).toEqual({ approved: false, reason: 'stranger' });
  });
});

describe('normalizeEmail', () => {
  it('trims and lowers', () => {
    expect(normalizeEmail('  OWNER@Trusted.Example  ')).toBe(
      'owner@trusted.example',
    );
    expect(normalizeEmail(undefined)).toBe('');
  });
});
