/**
 * Vitest setup file: point every test file at the isolated test database
 * and inject deterministic Authentik group names.
 */

const TEST_URL = 'postgres://velvetscoop:velvetscoop@localhost:5433/velvetscoop_test';
if (!process.env['DATABASE_URL'] || process.env['DATABASE_URL']?.endsWith('/velvetscoop')) {
  process.env['DATABASE_URL'] = TEST_URL;
}
process.env['REDIS_URL'] ??= 'redis://localhost:6380';
process.env['SESSION_SECRET'] ??= 'test-secret';
process.env['AUTHENTIK_ISSUER_URL'] ??= 'https://auth.example.invalid/';
process.env['AUTHENTIK_CLIENT_ID'] ??= 'test-client';
process.env['AUTHENTIK_CLIENT_SECRET'] ??= 'test-client-secret';
process.env['AUTHENTIK_REDIRECT_URI'] ??= 'http://localhost:3000/api/auth/callback';
process.env['AUTHENTIK_MEMBER_GROUP'] ??= 'velvet-scoop-users';
process.env['AUTHENTIK_ADMIN_GROUP'] ??= 'velvet-scoop-admins';
