const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwertyuiop', 'qwerty123', 'iloveyou', 'letmein123',
  'admin123', 'welcome1', 'welcome123', 'abc12345', 'football1', 'monkey123', 'dragon123', 'sunshine1', 'princess1', 'passw0rd',
  'voidspace', 'voidspace1', 'changeme', 'trustno1', '11111111', '00000000', 'zxcvbnm123',
]);

/** Returns a message if the password is not acceptable, or null if it is. */
export function checkPasswordStrength(password: string, who: { username?: string; email?: string } = {}): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 100) return 'Password must be less than 100 characters';
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return 'That password is too common. Choose something harder to guess.';
  if (who.username && lower.includes(who.username.toLowerCase()) && who.username.length >= 4) return 'Your password should not contain your username.';
  const local = who.email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return 'Your password should not contain your email name.';
  return null;
}
