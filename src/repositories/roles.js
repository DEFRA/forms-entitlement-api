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
 * @enum {{ name: string, code: string, description: string}}
 */
export const RoleDetails = {
  [Roles.Admin]: {
    name: 'Admin',
    code: 'admin',
    description: 'Can publish and delete forms and manage users'
  },
  [Roles.FormCreator]: {
    name: 'Form creator',
    code: 'form-creator',
    description: 'Can create and edit existing forms only'
  }
}
