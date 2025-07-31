import { createServer } from '~/src/api/server.js'
import { config } from '~/src/config/index.js'
import { getErrorMessage } from '~/src/helpers/error-message.js'
import { createLogger } from '~/src/helpers/logging/logger.js'
import { syncAdminUsersFromGroup } from '~/src/services/user.js'

const logger = createLogger()

process.on('unhandledRejection', (error) => {
  logger.error(
    `[unhandledRejection] Unhandled rejection - ${getErrorMessage(error)}`
  )
  throw error
})

/**
 * Starts the server.
 */
export async function listen() {
  const server = await createServer()
  await server.start()

  try {
    await syncAdminUsersFromGroup()
  } catch (error) {
    server.logger.warn(
      'Failed to sync admin users from group: ' + getErrorMessage(error)
    )
  }

  server.logger.info('Server started successfully')
  server.logger.info(
    `Access your backend on http://localhost:${config.get('port')}`
  )
}
