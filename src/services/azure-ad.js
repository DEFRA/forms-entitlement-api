import { ClientSecretCredential } from '@azure/identity'
import Boom from '@hapi/boom'
import { Client } from '@microsoft/microsoft-graph-client'
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js'

import { config } from '~/src/config/index.js'
import { getErrorMessage } from '~/src/helpers/error-message.js'
import { createLogger } from '~/src/helpers/logging/logger.js'

const logger = createLogger()

/**
 * Azure AD service for interacting with Microsoft Graph API
 */
class AzureAdService {
  /**
   * Create Azure AD service instance
   */
  constructor() {
    const clientId = config.get('azure.clientId')
    const clientSecret = config.get('azure.clientSecret')
    const tenantId = config.get('azure.tenantId')

    if (!clientSecret) {
      throw new Error('Azure client secret is required for Graph API access')
    }

    const credential = new ClientSecretCredential(
      tenantId,
      clientId,
      clientSecret
    )
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default']
    })

    this.graphClient = Client.initWithMiddleware({ authProvider })
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
    } catch (error) {
      logger.error(
        `[azureFetchGroupMembers] Failed to fetch group members for ${groupId}: ${getErrorMessage(error)}`
      )
      throw Boom.internal(
        `Failed to fetch group members: ${getErrorMessage(error)}`
      )
    }
  }

  /**
   * Look up a user by email address and get their Azure AD details
   * @param {string} email - The user's email address
   * @returns {Promise<AzureUser>} User details from Azure AD
   */
  async getUserByEmail(email) {
    try {
      logger.info(`[azureGetUserByEmail] Looking up user by email: ${email}`)

      const user = await this.graphClient
        .api(`/users/${email}`)
        .select('id,givenName,surname,displayName,mail,userPrincipalName')
        .get()

      const firstName = user.givenName
      const lastName = user.surname
      const displayName =
        firstName && lastName
          ? `${firstName} ${lastName}`
          : (user.displayName ?? '')

      const foundUser = {
        id: user.id,
        displayName,
        email: user.mail ?? user.userPrincipalName
      }

      logger.info(`[azureGetUserByEmail] Found user: ${user.id} (${email})`)
      return foundUser
    } catch (error) {
      logger.error(
        `[azureGetUserByEmail] Failed to find user by email ${email}: ${getErrorMessage(error)}`
      )

      if (
        error &&
        typeof error === 'object' &&
        /** @type {any} */ (error).status === 404
      ) {
        throw Boom.notFound(`User not found in Azure AD: ${email}`)
      }

      throw Boom.internal(
        `Failed to look up user by email: ${getErrorMessage(error)}`
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
        .select('id,givenName,surname,displayName,mail,userPrincipalName')
        .get()

      const firstName = user.givenName
      const lastName = user.surname
      const displayName =
        firstName && lastName
          ? `${firstName} ${lastName}`
          : (user.displayName ?? '')

      const validatedUser = {
        id: user.id,
        displayName,
        email: user.mail ?? user.userPrincipalName
      }

      logger.info(`[azureValidateUser] User validated: ${userId}`)
      return validatedUser
    } catch (error) {
      logger.error(
        `[azureValidateUser] Failed to validate user ${userId}: ${getErrorMessage(error)}`
      )

      if (
        error &&
        typeof error === 'object' &&
        /** @type {any} */ (error).status === 404
      ) {
        throw Boom.notFound(`User not found in Azure AD: ${userId}`)
      }

      throw Boom.internal(
        `Failed to validate user in Azure AD: ${getErrorMessage(error)}`
      )
    }
  }
}

let azureAdService = null

/**
 * Get the Azure AD service instance
 * @returns {AzureAdService} The Azure AD service instance
 */
export function getAzureAdService() {
  azureAdService ??= new AzureAdService()
  return azureAdService
}

/**
 * @typedef {object} AzureUser
 * @property {string} id - Azure AD object ID
 * @property {string} displayName - User's display name (givenName + surname)
 * @property {string} email - User's email address
 */
