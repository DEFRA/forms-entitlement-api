import Boom from '@hapi/boom'

import { getErrorMessage } from '~/src/helpers/error-message.js'
import { createLogger } from '~/src/helpers/logging/logger.js'

const logger = createLogger()

/**
 * Manually trigger admin user sync
 */
const triggerAdminSync = /** @type {ServerRoute} */ ({
  method: 'POST',
  path: '/scheduler/sync-admin-users',
  options: {
    auth: false,
    description: 'Manually trigger admin user sync from Azure AD',
    tags: ['api', 'scheduler'],
    validate: {
      options: {
        abortEarly: false
      }
    }
  },
  handler: async (request) => {
    try {
      const scheduler = request.server.app.scheduler

      if (!scheduler) {
        throw Boom.internal('Scheduler service not available')
      }

      logger.info('[SchedulerRoute] Manually triggering admin user sync')

      const success = await scheduler.triggerTask('admin-user-sync')

      if (!success) {
        throw Boom.internal('Failed to trigger admin user sync')
      }

      logger.info('[SchedulerRoute] Successfully triggered admin user sync')

      return {
        status: 'success',
        message: 'Admin user sync triggered successfully'
      }
    } catch (error) {
      logger.error(
        `[SchedulerRoute] Failed to trigger admin user sync: ${getErrorMessage(error)}`
      )
      throw error
    }
  }
})

/**
 * @type {ServerRoute[]}
 */
export default [triggerAdminSync]

/**
 * @import { ServerRoute } from '@hapi/hapi'
 */
