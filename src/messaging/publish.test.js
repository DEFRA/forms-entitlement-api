import {
  AuditEventMessageCategory,
  AuditEventMessageSchemaVersion,
  AuditEventMessageSource,
  AuditEventMessageType
} from '@defra/forms-model'
import { ValidationError } from 'joi'

import {
  adminRole,
  azureUser,
  callingUser
} from '~/src/messaging/__stubs__/users.js'
import { publishEvent } from '~/src/messaging/publish-base.js'
import {
  publishEntitlementCreatedEvent,
  publishEntitlementDeletedEvent,
  publishEntitlementUpdatedEvent
} from '~/src/messaging/publish.js'

jest.mock('~/src/messaging/publish-base.js')

describe('publish', () => {
  beforeEach(() => {
    jest.mocked(publishEvent).mockResolvedValue({
      MessageId: '2888a402-7609-43c5-975f-b1974969cdb6',
      SequenceNumber: undefined,
      $metadata: {}
    })
  })
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('publishEntitlementCreatedEvent', () => {
    it('should publish ENTITLEMENT_CREATED event', async () => {
      await publishEntitlementCreatedEvent(azureUser, adminRole, callingUser)

      expect(publishEvent).toHaveBeenCalledWith({
        entityId: azureUser.id,
        source: AuditEventMessageSource.ENTITLEMENT,
        messageCreatedAt: expect.any(Date),
        schemaVersion: AuditEventMessageSchemaVersion.V1,
        category: AuditEventMessageCategory.ENTITLEMENT,
        type: AuditEventMessageType.ENTITLEMENT_CREATED,
        createdAt: expect.any(Date),
        createdBy: callingUser,
        data: {
          userId: azureUser.id,
          email: azureUser.email,
          roles: adminRole
        }
      })
    })

    it('should not publish the event if the schema is incorrect', async () => {
      jest.mocked(publishEvent).mockRejectedValue(new Error('rejected'))
      const invalidAzureUser = {}

      await expect(
        // @ts-expect-error - invalid schema
        publishEntitlementCreatedEvent(invalidAzureUser, adminRole, callingUser)
      ).rejects.toThrow(new ValidationError('"entityId" is required', [], {}))
    })
  })

  describe('publishEntitlementUpdatedEvent', () => {
    it('should publish ENTITLEMENT_UPDATED event', async () => {
      await publishEntitlementUpdatedEvent(azureUser, adminRole, callingUser)

      expect(publishEvent).toHaveBeenCalledWith({
        entityId: azureUser.id,
        source: AuditEventMessageSource.ENTITLEMENT,
        messageCreatedAt: expect.any(Date),
        schemaVersion: AuditEventMessageSchemaVersion.V1,
        category: AuditEventMessageCategory.ENTITLEMENT,
        type: AuditEventMessageType.ENTITLEMENT_UPDATED,
        createdAt: expect.any(Date),
        createdBy: callingUser,
        data: {
          userId: azureUser.id,
          email: azureUser.email,
          roles: adminRole
        }
      })
    })

    it('should not publish the event if the schema is incorrect', async () => {
      jest.mocked(publishEvent).mockRejectedValue(new Error('rejected'))
      const invalidAzureUser = {}

      await expect(
        // @ts-expect-error - invalid schema
        publishEntitlementUpdatedEvent(invalidAzureUser, adminRole, callingUser)
      ).rejects.toThrow(new ValidationError('"entityId" is required', [], {}))
    })
  })

  describe('publishEntitlementDeletedEvent', () => {
    it('should publish ENTITLEMENT_DELETED event', async () => {
      await publishEntitlementDeletedEvent(azureUser, callingUser)

      expect(publishEvent).toHaveBeenCalledWith({
        entityId: azureUser.id,
        source: AuditEventMessageSource.ENTITLEMENT,
        messageCreatedAt: expect.any(Date),
        schemaVersion: AuditEventMessageSchemaVersion.V1,
        category: AuditEventMessageCategory.ENTITLEMENT,
        type: AuditEventMessageType.ENTITLEMENT_DELETED,
        createdAt: expect.any(Date),
        createdBy: callingUser,
        data: {
          userId: azureUser.id,
          email: azureUser.email,
          roles: []
        }
      })
    })

    it('should not publish the event if the schema is incorrect', async () => {
      jest.mocked(publishEvent).mockRejectedValue(new Error('rejected'))
      const invalidAzureUser = {}

      await expect(
        // @ts-expect-error - invalid schema
        publishEntitlementDeletedEvent(invalidAzureUser, callingUser)
      ).rejects.toThrow(new ValidationError('"entityId" is required', [], {}))
    })
  })
})
