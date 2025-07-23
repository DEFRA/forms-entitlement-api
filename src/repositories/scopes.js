import { Roles } from '~/src/repositories/roles.js'

/**
 * @readonly
 * @enum {string}
 */
export const Scopes = {
  FormDelete: 'form-delete',
  FormEdit: 'form-edit',
  FormRead: 'form-read',
  UserCreate: 'user-create',
  UserDelete: 'user-delete',
  UserEdit: 'user-edit'
}

export const RoleScopes = {
  [Roles.Admin]: Object.entries(Scopes).map((x) => x[1]),
  [Roles.FormCreator]: [Scopes.FormRead, Scopes.FormEdit]
}

/**
 * @param {string[]} roles
 */
export function mapScopesToRoles(roles) {
  const scopes = /** @type {string[]} */ ([])
  roles.forEach((role) => {
    scopes.push(...RoleScopes[role])
  })
  return scopes
}
