/**
 * @readonly
 * @enum {string}
 */
export const Roles = {
  Admin: 'admin',
  FormCreator: 'form-creator'
}

/**
 * @readonly
 * @enum {{ name: string, code: string}}
 */
export const RoleDetails = {
  [Roles.Admin]: {
    name: 'Admin',
    code: 'admin'
  },
  [Roles.FormCreator]: {
    name: 'Form creator',
    code: 'form-creator'
  }
}
