import Boom from '@hapi/boom'

import { getErrorMessage } from '~/src/helpers/error-message.js'
import { syncAdminUsersFromGroup } from '~/src/services/user.js'

/**
 * @type {ServerRoute[]}
 */
export default [
  {
    method: 'POST',
    path: '/users/sync',
    handler: async (request, h) => {
      try {
        await syncAdminUsersFromGroup()

        return h.response({
          message: 'Admin users synced successfully'
        })
      } catch (error) {
        if (Boom.isBoom(error)) {
          throw error
        }

        request.logger.error(`User sync failed: ${getErrorMessage(error)}`)
        throw Boom.internal('An error occurred while processing your request')
      }
    },
    options: {
      auth: 'azure-oidc-token',
      description: 'Sync admin users from Azure AD group to entitlements api',
      notes:
        'Synchronizes admin users from the configured Azure AD role editor group',
      tags: ['api', 'sync', 'users']
    }
  }
]

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
