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
    description: 'Allows full access to forms and user management functions'
  },
  [Roles.FormCreator]: {
    name: 'Form creator',
    code: 'form-creator',
    description: 'Allows a user to create a form and edit it while in draft'
  }
}
