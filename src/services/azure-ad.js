import { ClientSecretCredential } from '@azure/identity'
import { Client } from '@microsoft/microsoft-graph-client'

import { config } from '~/src/config/index.js'
import { getErrorMessage } from '~/src/helpers/error-message.js'
import { createLogger } from '~/src/helpers/logging/logger.js'

const logger = createLogger()

/**
 * Simple auth provider that implements the required interface
 */
class SimpleAuthProvider {
  /**
   * Create SimpleAuthProvider instance
   * @param {ClientSecretCredential} credential - The Azure credential
   */
  constructor(credential) {
    this.credential = credential
  }

  /**
   * Get access token for Microsoft Graph
   * @returns {Promise<string>} The access token
   */
  async getAccessToken() {
    const tokenResponse = await this.credential.getToken(
      'https://graph.microsoft.com/.default'
    )
    return tokenResponse.token
  }
}

/**
 * Azure AD service for interacting with Microsoft Graph API
 */
class AzureAdService {
  /**
   * Create Azure AD service instance
   */
  constructor() {
    this.clientId = config.get('azure.clientId')
    this.clientSecret = config.get('azure.clientSecret')
    this.tenantId = config.get('azure.tenantId')

    if (!this.clientSecret) {
      throw new Error('Azure client secret is required for Graph API access')
    }

    this.credential = new ClientSecretCredential(
      this.tenantId,
      this.clientId,
      this.clientSecret
    )

    this.authProvider = new SimpleAuthProvider(this.credential)

    this.graphClient = Client.initWithMiddleware({
      authProvider: this.authProvider
    })
  }

  /**
   * Get group members from Azure AD
   * @param {string} groupId - The Azure AD group ID
   * @returns {Promise<AzureUser[]>} Array of group members
   */
  async getGroupMembers(groupId) {
    try {
      logger.info(
        `[azureFetchGroupMembers] Fetching members for group: ${groupId}`
      )

      const members = await this.graphClient
        .api(`/groups/${groupId}/members`)
        .select('id,displayName,mail,userPrincipalName')
        .get()

      const users = members.value
        .filter(
          /** @param {any} member */ (member) =>
            member['@odata.type'] === '#microsoft.graph.user'
        )
        .map(
          /** @param {any} user */ (user) => ({
            id: user.id,
            displayName: user.displayName,
            email: user.mail ?? user.userPrincipalName
          })
        )

      logger.info(
        `[azureFetchGroupMembers] Found ${users.length} users in group ${groupId}`
      )
      return users
    } catch (error_) {
      logger.error(
        `[azureFetchGroupMembersError] Failed to fetch group members for ${groupId}: ${getErrorMessage(error_)}`
      )
      throw new Error(
        `Failed to fetch group members: ${getErrorMessage(error_)}`
      )
    }
  }

  /**
   * Validate if a user exists in Azure AD and get their details
   * @param {string} userId - The Azure AD user ID (object ID)
   * @returns {Promise<AzureUser>} User details from Azure AD
   */
  async validateUser(userId) {
    try {
      logger.info(`[azureValidateUser] Validating user: ${userId}`)

      const user = await this.graphClient
        .api(`/users/${userId}`)
        .select('id,displayName,mail,userPrincipalName')
        .get()

      const validatedUser = {
        id: user.id,
        displayName: user.displayName,
        email: user.mail ?? user.userPrincipalName
      }

      logger.info(`[azureValidateUser] User validated: ${userId}`)
      return validatedUser
    } catch (error_) {
      if (
        error_ &&
        typeof error_ === 'object' &&
        'code' in error_ &&
        error_.code === 'Request_ResourceNotFound'
      ) {
        logger.warn(`[azureUserNotFound] User not found in Azure AD: ${userId}`)
        throw new Error(`User not found in Azure AD: ${userId}`)
      }

      logger.error(
        `[azureValidateUserError] Failed to validate user ${userId}: ${getErrorMessage(error_)}`
      )
      throw new Error(`Failed to validate user: ${getErrorMessage(error_)}`)
    }
  }
}

// Create singleton instance
let azureAdService = null

/**
 * Get the Azure AD service singleton instance
 * @returns {AzureAdService} The Azure AD service instance
 */
export function getAzureAdService() {
  azureAdService ??= new AzureAdService()
  return azureAdService
}

/**
 * @typedef {object} AzureUser
 * @property {string} id - Azure AD object ID
 * @property {string} displayName - User's display name
 * @property {string} email - User's email address
 */
