import { getErrorMessage } from '@defra/forms-model'
import Boom from '@hapi/boom'

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
    } catch (err) {
      logger.error(
        err,
        `[SchedulerRoute] Failed to trigger admin user sync: ${getErrorMessage(err)}`
      )
      throw err
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
