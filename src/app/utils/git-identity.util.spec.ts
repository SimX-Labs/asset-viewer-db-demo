import { formatGitIdentity, gitDisplayName, gitEmail, parseGitIdentity } from './git-identity.util';

describe('formatGitIdentity', () => {
  it('joins a distinct name and email', () => {
    expect(formatGitIdentity({ name: 'Jason Ribeira', email: 'jason@simx.com' })).toBe(
      'Jason Ribeira <jason@simx.com>',
    );
  });

  it('falls back to whichever side is present', () => {
    expect(formatGitIdentity({ name: '', email: 'jason@simx.com' })).toBe('jason@simx.com');
    expect(formatGitIdentity({ name: 'Caolan', email: '' })).toBe('Caolan');
    expect(formatGitIdentity(null)).toBe('');
  });
});

describe('parseGitIdentity', () => {
  it('splits a name-email pair', () => {
    expect(parseGitIdentity('Jason Ribeira <jason@simx.com>')).toEqual({
      name: 'Jason Ribeira',
      email: 'jason@simx.com',
    });
  });

  it('treats a bare email as email-only', () => {
    expect(parseGitIdentity('jason@simx.com')).toEqual({
      name: '',
      email: 'jason@simx.com',
    });
  });

  it('treats a bare name as name-only', () => {
    expect(parseGitIdentity('Caolan')).toEqual({
      name: 'Caolan',
      email: '',
    });
  });
});

describe('gitDisplayName / gitEmail', () => {
  it('prefers the username and keeps the email for hover', () => {
    expect(gitDisplayName('pfmallon <paul.frank.mallon@gmail.com>')).toBe('pfmallon');
    expect(gitEmail('pfmallon <paul.frank.mallon@gmail.com>')).toBe(
      'paul.frank.mallon@gmail.com',
    );
  });

  it('falls back to the email when no name is present', () => {
    expect(gitDisplayName('jason@simx.com')).toBe('jason@simx.com');
    expect(gitEmail('jason@simx.com')).toBe('jason@simx.com');
  });
});
