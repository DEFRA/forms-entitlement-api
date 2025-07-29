import Boom from '@hapi/boom'
import Joi from 'joi'

import { getErrorMessage } from '~/src/helpers/error-message.js'
import { Roles } from '~/src/repositories/roles.js'
import { migrateUsersFromAzureGroup } from '~/src/services/user.js'

/**
 * @type {ServerRoute[]}
 */
export default [
  {
    method: 'POST',
    path: '/users/migrate',
    handler: async (request, h) => {
      const { roles = [Roles.FormCreator] } =
        /** @type {{roles?: string[]}} */ (request.payload) || {}

      try {
        const migrationResult = await migrateUsersFromAzureGroup(roles)

        return h.response({
          message: 'Migration completed',
          ...migrationResult
        })
      } catch (error) {
        if (Boom.isBoom(error)) {
          throw error
        }

        request.logger.error(`User migration failed: ${getErrorMessage(error)}`)
        throw Boom.internal('An error occurred while processing your request')
      }
    },
    options: {
      auth: 'azure-oidc-token',
      validate: {
        payload: Joi.object({
          roles: Joi.array()
            .items(
              Joi.string().valid(
                Roles.Admin,
                'form-publisher',
                Roles.FormCreator
              )
            )
            .optional()
        }).allow(null)
      },
      description: 'Migrate users from Azure AD group to entitlements api',
      notes:
        'Bulk imports users from the configured Azure AD migration source group',
      tags: ['api', 'migration', 'users']
    }
  }
]

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
