import { Roles } from '~/src/repositories/roles.js'
import { mapScopesToRoles } from '~/src/repositories/scopes.js'

describe('Scopes', () => {
  test('should return all Admin scopes', () => {
    expect(mapScopesToRoles([Roles.Admin])).toEqual([
      'form-delete',
      'form-edit',
      'form-read',
      'user-create',
      'user-delete',
      'user-edit'
    ])
  })
})
