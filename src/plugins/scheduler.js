import { getErrorMessage } from '@defra/forms-model'

import { initialiseAdminUserSync } from '~/src/services/scheduler.js'
import { syncAdminUsersFromGroup } from '~/src/services/user.js'

/**
 * @satisfies {ServerRegisterPluginObject<void>}
 */
export const scheduler = {
  plugin: {
    name: 'scheduler',
    version: '1.0.0',
    register(server) {
      try {
        const schedulerService = initialiseAdminUserSync(
          syncAdminUsersFromGroup
        )

        if (schedulerService) {
          schedulerService.start()

          server.app.scheduler = schedulerService

          server.events.on('stop', () => {
            server.logger.info(
              '[SchedulerPlugin] Stopping scheduler due to server shutdown'
            )
            schedulerService.stop()
          })
        } else {
          server.logger.info(
            '[SchedulerPlugin] Scheduler disabled via configuration'
          )

          server.app.scheduler = null
        }
      } catch (err) {
        server.logger.error(
          err,
          `[SchedulerPlugin] Failed to initialize scheduler: ${getErrorMessage(err)}`
        )
        throw err
      }
    }
  }
}

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
