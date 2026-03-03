import { Roles } from '@defra/forms-model'

import {
  validateNotSelfAction,
  validateRoleHierarchy,
  validateUserManagement
} from '~/src/helpers/authorisation.js'

describe('Authorisation helper', () => {
  describe('validateNotSelfAction', () => {
    it('should throw 403 when callingUserId equals targetUserId', () => {
      expect.assertions(2)

      expect(() => {
        validateNotSelfAction('user-1', 'user-1')
      }).toThrow(
        expect.objectContaining({
          isBoom: true,
          output: expect.objectContaining({ statusCode: 403 })
        })
      )

      expect(() => {
        validateNotSelfAction('user-1', 'user-1')
      }).toThrow(/your own account/)
    })

    it('should not throw when callingUserId differs from targetUserId', () => {
      expect(() => {
        validateNotSelfAction('user-1', 'user-2')
      }).not.toThrow()
    })
  })

  describe('validateRoleHierarchy', () => {
    describe('superadmin caller', () => {
      const superadminRoles = [Roles.Superadmin]

      it('should allow managing superadmin users', () => {
        expect(() => {
          validateRoleHierarchy(superadminRoles, [Roles.Superadmin])
        }).not.toThrow()
      })

      it('should allow managing admin users', () => {
        expect(() => {
          validateRoleHierarchy(superadminRoles, [Roles.Admin])
        }).not.toThrow()
      })

      it('should allow managing form-publisher users', () => {
        expect(() => {
          validateRoleHierarchy(superadminRoles, [Roles.FormPublisher])
        }).not.toThrow()
      })

      it('should allow managing form-creator users', () => {
        expect(() => {
          validateRoleHierarchy(superadminRoles, [Roles.FormCreator])
        }).not.toThrow()
      })
    })

    describe('admin caller', () => {
      const adminRoles = [Roles.Admin]

      it('should allow managing form-publisher users', () => {
        expect(() => {
          validateRoleHierarchy(adminRoles, [Roles.FormPublisher])
        }).not.toThrow()
      })

      it('should allow managing form-creator users', () => {
        expect(() => {
          validateRoleHierarchy(adminRoles, [Roles.FormCreator])
        }).not.toThrow()
      })

      it('should throw 403 when trying to manage admin users', () => {
        expect(() => {
          validateRoleHierarchy(adminRoles, [Roles.Admin])
        }).toThrow(
          expect.objectContaining({
            isBoom: true,
            output: expect.objectContaining({ statusCode: 403 }),
            message: `You do not have sufficient privileges to manage ${Roles.Admin} users`
          })
        )
      })

      it('should throw 403 when trying to manage superadmin users', () => {
        expect(() => {
          validateRoleHierarchy(adminRoles, [Roles.Superadmin])
        }).toThrow(
          expect.objectContaining({
            isBoom: true,
            output: expect.objectContaining({ statusCode: 403 }),
            message: `You do not have sufficient privileges to manage ${Roles.Superadmin} users`
          })
        )
      })

      it('should throw 403 when target roles contain a mix including admin', () => {
        expect(() => {
          validateRoleHierarchy(adminRoles, [Roles.FormCreator, Roles.Admin])
        }).toThrow(
          expect.objectContaining({
            isBoom: true,
            output: expect.objectContaining({ statusCode: 403 }),
            message: `You do not have sufficient privileges to manage ${Roles.Admin} users`
          })
        )
      })

      it('should throw 403 when target roles contain a mix including superadmin', () => {
        expect(() => {
          validateRoleHierarchy(adminRoles, [
            Roles.FormCreator,
            Roles.Superadmin
          ])
        }).toThrow(
          expect.objectContaining({
            isBoom: true,
            output: expect.objectContaining({ statusCode: 403 }),
            message: `You do not have sufficient privileges to manage ${Roles.Superadmin} users`
          })
        )
      })

      it('should throw 403 listing multiple disallowed roles', () => {
        expect(() => {
          validateRoleHierarchy(adminRoles, [Roles.Admin, Roles.Superadmin])
        }).toThrow(
          expect.objectContaining({
            isBoom: true,
            output: expect.objectContaining({ statusCode: 403 }),
            message: `You do not have sufficient privileges to manage ${Roles.Admin} or ${Roles.Superadmin} users`
          })
        )
      })
    })

    describe('non-admin/non-superadmin caller (defensive)', () => {
      it('should throw 403 for form-creator caller', () => {
        expect(() => {
          validateRoleHierarchy([Roles.FormCreator], [Roles.FormCreator])
        }).toThrow(
          expect.objectContaining({
            isBoom: true,
            output: expect.objectContaining({ statusCode: 403 }),
            message: 'You do not have sufficient privileges to manage users'
          })
        )
      })

      it('should throw 403 for form-publisher caller', () => {
        expect(() => {
          validateRoleHierarchy([Roles.FormPublisher], [Roles.FormCreator])
        }).toThrow(
          expect.objectContaining({
            isBoom: true,
            output: expect.objectContaining({ statusCode: 403 }),
            message: 'You do not have sufficient privileges to manage users'
          })
        )
      })

      it('should throw 403 for empty roles', () => {
        expect(() => {
          validateRoleHierarchy([], [Roles.FormCreator])
        }).toThrow(
          expect.objectContaining({
            isBoom: true,
            output: expect.objectContaining({ statusCode: 403 }),
            message: 'You do not have sufficient privileges to manage users'
          })
        )
      })
    })
  })

  describe('validateUserManagement', () => {
    it('should run both self-management and hierarchy checks successfully', () => {
      expect(() => {
        validateUserManagement('user-1', [Roles.Admin], 'user-2', [
          Roles.FormCreator
        ])
      }).not.toThrow()
    })

    it('should throw on self-management before hierarchy check', () => {
      expect(() => {
        validateUserManagement('user-1', [Roles.Superadmin], 'user-1', [
          Roles.FormCreator
        ])
      }).toThrow(
        expect.objectContaining({
          isBoom: true,
          output: expect.objectContaining({ statusCode: 403 }),
          message: 'You cannot perform this action on your own account'
        })
      )
    })

    it('should throw on hierarchy violation when not a self-action', () => {
      expect(() => {
        validateUserManagement('user-1', [Roles.Admin], 'user-2', [
          Roles.Superadmin
        ])
      }).toThrow(
        expect.objectContaining({
          isBoom: true,
          output: expect.objectContaining({ statusCode: 403 }),
          message: `You do not have sufficient privileges to manage ${Roles.Superadmin} users`
        })
      )
    })

    it("should throw when caller cannot manage the target user's current roles", () => {
      expect(() => {
        validateUserManagement(
          'user-1',
          [Roles.Admin],
          'user-2',
          [Roles.FormCreator],
          [Roles.Admin]
        )
      }).toThrow(
        expect.objectContaining({
          isBoom: true,
          output: expect.objectContaining({ statusCode: 403 }),
          message: `You do not have sufficient privileges to manage ${Roles.Admin} users`
        })
      )
    })

    it('should succeed when caller can manage both requested and current roles', () => {
      expect(() => {
        validateUserManagement(
          'user-1',
          [Roles.Superadmin],
          'user-2',
          [Roles.FormCreator],
          [Roles.Admin]
        )
      }).not.toThrow()
    })

    it('should skip hierarchy checks when both role arrays are empty', () => {
      expect(() => {
        validateUserManagement('user-1', [Roles.Admin], 'user-2', [], [])
      }).not.toThrow()
    })
  })
})
