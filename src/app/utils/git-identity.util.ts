export interface GitIdentity {
  name?: string | null;
  email?: string | null;
}

const NAME_EMAIL = /^(.*?)\s*<([^<>]+)>\s*$/;

/** `Name <email>` when both are present and distinct; otherwise whichever exists. */
export function formatGitIdentity(person: GitIdentity | null | undefined): string {
  if (!person) return '';
  const name = (person.name ?? '').trim();
  const email = (person.email ?? '').trim();
  if (name && email && name.toLowerCase() !== email.toLowerCase()) {
    return `${name} <${email}>`;
  }
  return email || name;
}

/** Split `Name <email>` (or a bare name/email) back into parts. */
export function parseGitIdentity(raw: string | null | undefined): GitIdentity {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { name: '', email: '' };
  const match = trimmed.match(NAME_EMAIL);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  if (trimmed.includes('@') && !trimmed.includes(' ')) {
    return { name: '', email: trimmed };
  }
  return { name: trimmed, email: '' };
}

/** Username / display name; falls back to the email when no name is present. */
export function gitDisplayName(raw: string | GitIdentity | null | undefined): string {
  const person = typeof raw === 'string' || raw == null ? parseGitIdentity(raw) : raw;
  const name = (person.name ?? '').trim();
  const email = (person.email ?? '').trim();
  if (name && name.toLowerCase() !== email.toLowerCase()) return name;
  return email || name;
}

export function gitEmail(raw: string | GitIdentity | null | undefined): string {
  const person = typeof raw === 'string' || raw == null ? parseGitIdentity(raw) : raw;
  return (person.email ?? '').trim();
}
