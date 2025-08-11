import {
  AuditEventMessageCategory,
  AuditEventMessageSchemaVersion,
  AuditEventMessageSource,
  AuditEventMessageType
} from '@defra/forms-model'

/**
 * @param {AzureUser} azureUser
 * @param {string[]} roles
 * @param {AuditUser} callingUser
 * @returns {EntitlementCreatedMessage}
 */
export function entitlementBaseMapper(azureUser, roles, callingUser) {
  /** @type {EntitlementMessageData} */
  const data = {
    userId: azureUser.id,
    email: azureUser.email,
    roles
  }
  const now = new Date()
  return {
    schemaVersion: AuditEventMessageSchemaVersion.V1,
    category: AuditEventMessageCategory.ENTITLEMENT,
    source: AuditEventMessageSource.ENTITLEMENT,
    type: AuditEventMessageType.ENTITLEMENT_CREATED,
    entityId: data.userId,
    createdAt: now,
    createdBy: {
      id: callingUser.id,
      displayName: callingUser.displayName
    },
    data,
    messageCreatedAt: now
  }
}

/**
 * @param {AzureUser} azureUser
 * @param {string[]} roles
 * @param {AuditUser} callingUser
 * @returns {EntitlementCreatedMessage}
 */
export function entitlementCreatedMapper(azureUser, roles, callingUser) {
  return {
    ...entitlementBaseMapper(azureUser, roles, callingUser),
    type: AuditEventMessageType.ENTITLEMENT_CREATED
  }
}

/**
 * @param {AzureUser} azureUser
 * @param {string[]} roles
 * @param {AuditUser} callingUser
 * @returns {EntitlementUpdatedMessage}
 */
export function entitlementUpdatedMapper(azureUser, roles, callingUser) {
  return {
    ...entitlementBaseMapper(azureUser, roles, callingUser),
    type: AuditEventMessageType.ENTITLEMENT_UPDATED
  }
}

/**
 * @param {AzureUser} azureUser
 * @param {AuditUser} callingUser
 * @returns {EntitlementDeletedMessage}
 */
export function entitlementDeletedMapper(azureUser, callingUser) {
  return {
    ...entitlementBaseMapper(azureUser, [], callingUser),
    type: AuditEventMessageType.ENTITLEMENT_DELETED
  }
}

/**
 * @import { AuditUser, EntitlementCreatedMessage, EntitlementDeletedMessage, EntitlementMessageBase, EntitlementMessageData, EntitlementUpdatedMessage } from '@defra/forms-model'
 * @import { AzureUser } from '~/src/services/azure-ad.js'
 */
