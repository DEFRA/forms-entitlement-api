import { Roles } from '~/src/repositories/roles.js'

/**
 * @readonly
 * @enum {string}
 */
export enum Scopes {
  FormDelete = 'form-delete',
  FormEdit = 'form-edit',
  FormRead = 'form-read',
  FormPublish = 'form-publish',
  UserCreate = 'user-create',
  UserDelete = 'user-delete',
  UserEdit = 'user-edit'
}

export const RoleScopes = {
  [Roles.Admin]: Object.entries(Scopes).map((x) => x[1]),
  [Roles.FormCreator]: [Scopes.FormRead, Scopes.FormEdit]
}

/**
 * Return a unique list of scopes based on the array of roles passed in
 * @param {string[]} roles
 * @returns {string[]}
 */
export function mapScopesToRoles(roles) {
  const scopeSet = new Set()
  roles.forEach((role) => {
    const scopes = RoleScopes[role] ?? []
    scopes.forEach((scope) => {
      scopeSet.add(scope)
    })
  })
  return Array.from(scopeSet)
}
