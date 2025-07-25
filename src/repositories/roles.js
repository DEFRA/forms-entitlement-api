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
 * @enum {string}
 */
export const RoleDescriptions = {
  [Roles.Admin]: 'Allows full access to forms and user management functions',
  [Roles.FormCreator]:
    'Allows a user to create a form and edit it while in draft'
}
