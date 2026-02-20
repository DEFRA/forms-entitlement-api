import { Roles } from '@defra/forms-model'

/**
 * @readonly
 * @enum {{ name: string, code: string }}
 */
export const RoleDetails = {
  [Roles.Superadmin]: {
    name: 'Superadmin',
    code: 'superadmin'
  },
  [Roles.Admin]: {
    name: 'Admin',
    code: 'admin'
  },
  [Roles.FormPublisher]: {
    name: 'Form publisher',
    code: 'form-publisher'
  },
  [Roles.FormCreator]: {
    name: 'Form creator',
    code: 'form-creator'
  }
}
