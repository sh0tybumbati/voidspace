import type { Prisma } from '@prisma/client';

/**
 * Moderator permissions are stored as JSON, shaped like { all: true } or { edit_space: true }.
 * Treat anything that is not an object, or a missing key, as "no permission".
 */
export function hasModPermission(permissions: Prisma.JsonValue | null | undefined, key: string): boolean {
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) return false;
  const p = permissions as Prisma.JsonObject;
  return Boolean(p.all || p[key]);
}
