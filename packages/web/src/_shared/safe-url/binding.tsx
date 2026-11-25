/** The host may pass relative locations or credential-free web URLs. */
export function safeUrl(value: string | undefined, forLink = false) {
  if (!value || value.trim() !== value || /[\u0000-\u001f\u007f\\]/u.test(value)) return undefined;
  try {
    const parsed = new URL(value, 'https://example.invalid');
    const allowed = ['https:', 'http:'];
    if (forLink) allowed.push('mailto:', 'tel:');
    return allowed.includes(parsed.protocol) && !parsed.username && !parsed.password
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
