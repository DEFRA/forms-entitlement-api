import { getErrorMessage } from '~/src/helpers/error-message.js'
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

          // @ts-expect-error - Adding scheduler to app context
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
          // @ts-expect-error - Adding scheduler to app context
          server.app.scheduler = null
        }
      } catch (error) {
        server.logger.error(
          `[SchedulerPlugin] Failed to initialize scheduler: ${getErrorMessage(error)}`
        )
        throw error
      }
    }
  }
}

/**
 * @import { ServerRegisterPluginObject } from '@hapi/hapi'
 */
