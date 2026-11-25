// izin anahtarları tek kaynak (frontend sidebar + backend middleware).
export const ROLES = Object.freeze({ SUPER_ADMIN: 'SUPER_ADMIN', EDITOR: 'EDITOR' });

export const PERMISSION_MODULES = Object.freeze([
  'dashboard',
  'settings',
  'hero',
  'media',
  'status',
  'projects',
  'categories',
  'links',
  'messages',
  'system',
  'audit',
]);

/** Yalnızca okuma eylemi olan modüller. */
export const READ_ONLY_MODULES = Object.freeze(['dashboard', 'audit']);

export const PERMISSION_ACTIONS = Object.freeze(['read', 'write']);

/**
 * @param {{ role: string, permissions: string[] }} admin
 * @param {string} permission ör. "links:write"
 */
export function hasPermission(admin, permission) {
  if (!admin) return false;
  if (admin.role === ROLES.SUPER_ADMIN) return true;
  const [module, action] = permission.split(':');
  const granted = admin.permissions ?? [];
  if (granted.includes(permission)) return true;
  return action === 'read' && granted.includes(`${module}:write`);
}

/** @param {string} permission */
export function isValidPermission(permission) {
  const [module, action, extra] = String(permission).split(':');
  if (extra !== undefined || !PERMISSION_MODULES.includes(module)) return false;
  if (!PERMISSION_ACTIONS.includes(action)) return false;
  return !(action === 'write' && READ_ONLY_MODULES.includes(module));
}
