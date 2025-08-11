import {
  AuditEventMessageCategory,
  AuditEventMessageSchemaVersion,
  AuditEventMessageSource,
  AuditEventMessageType
} from '@defra/forms-model'

import {
  adminRole,
  azureUser,
  callingUser
} from '~/src/messaging/__stubs__/users.js'
import {
  entitlementCreatedMapper,
  entitlementDeletedMapper,
  entitlementUpdatedMapper
} from '~/src/messaging/mappers/events.js'

describe('entitlement-events', () => {
  describe('entitlementCreatedMapper', () => {
    it('should map a payload into a ENTITLEMENT_CREATED event', () => {
      expect(
        entitlementCreatedMapper(azureUser, adminRole, callingUser)
      ).toEqual({
        schemaVersion: AuditEventMessageSchemaVersion.V1,
        category: AuditEventMessageCategory.ENTITLEMENT,
        source: AuditEventMessageSource.ENTITLEMENT,
        type: AuditEventMessageType.ENTITLEMENT_CREATED,
        entityId: azureUser.id,
        createdAt: expect.any(Date),
        createdBy: callingUser,
        messageCreatedAt: expect.any(Date),
        data: {
          userId: azureUser.id,
          email: azureUser.email,
          roles: adminRole
        }
      })
    })

    it('should map a payload into a ENTITLEMENT_UPDATED event', () => {
      expect(
        entitlementUpdatedMapper(azureUser, adminRole, callingUser)
      ).toEqual({
        schemaVersion: AuditEventMessageSchemaVersion.V1,
        category: AuditEventMessageCategory.ENTITLEMENT,
        source: AuditEventMessageSource.ENTITLEMENT,
        type: AuditEventMessageType.ENTITLEMENT_UPDATED,
        entityId: azureUser.id,
        createdAt: expect.any(Date),
        createdBy: callingUser,
        messageCreatedAt: expect.any(Date),
        data: {
          userId: azureUser.id,
          email: azureUser.email,
          roles: adminRole
        }
      })
    })

    it('should map a payload into a ENTITLEMENT_DELETED event', () => {
      expect(entitlementDeletedMapper(azureUser, callingUser)).toEqual({
        schemaVersion: AuditEventMessageSchemaVersion.V1,
        category: AuditEventMessageCategory.ENTITLEMENT,
        source: AuditEventMessageSource.ENTITLEMENT,
        type: AuditEventMessageType.ENTITLEMENT_DELETED,
        entityId: azureUser.id,
        createdAt: expect.any(Date),
        createdBy: callingUser,
        messageCreatedAt: expect.any(Date),
        data: {
          userId: azureUser.id,
          email: azureUser.email,
          roles: []
        }
      })
    })
  })
})
