/**
 * Check the environment before the server starts, so a bad production setup fails loudly at boot
 * instead of quietly later. Returns problems (fatal) and warnings (worth knowing).
 */
export function checkConfig(env: NodeJS.ProcessEnv = process.env): { problems: string[]; warnings: string[] } {
  const problems: string[] = [];
  const warnings: string[] = [];
  const production = env.NODE_ENV === 'production';

  if (!env.DATABASE_URL) problems.push('DATABASE_URL is not set.');
  if (!env.JWT_SECRET) problems.push('JWT_SECRET is not set.');
  else if (production) {
    if (env.JWT_SECRET.length < 32) problems.push('JWT_SECRET must be at least 32 characters in production (try: openssl rand -base64 32).');
    if (/change-in-production|your-secret|secret-key|test-secret/i.test(env.JWT_SECRET)) problems.push('JWT_SECRET is still an example value. Generate a real one.');
  }
  if (production && !env.FRONTEND_URL) problems.push('FRONTEND_URL is not set (it controls which sites may call the API, and where email links point).');
  if (env.REQUIRE_EMAIL_VERIFICATION === '1' && !env.SMTP_HOST) problems.push('REQUIRE_EMAIL_VERIFICATION=1 needs SMTP_HOST, otherwise nobody can verify their email.');
  if (production && !env.SMTP_HOST) warnings.push('SMTP_HOST is not set: verification and password-reset emails will only be printed to the log.');
  if (production && env.REQUIRE_EMAIL_VERIFICATION !== '1') warnings.push('Email verification is not required. Set REQUIRE_EMAIL_VERIFICATION=1 for a public site.');
  if (production && !env.TRUST_PROXY) warnings.push('TRUST_PROXY is not set. Behind a tunnel or reverse proxy, set it (usually 1) so rate limits see real visitor addresses.');
  if (production && env.ALLOW_LAN_ORIGINS === '1') warnings.push('ALLOW_LAN_ORIGINS=1 also accepts private-network origins. Fine for a home install, unnecessary on a public site.');
  return { problems, warnings };
}
