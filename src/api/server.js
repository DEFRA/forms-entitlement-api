import path from 'path'

import hapi from '@hapi/hapi'

import { config } from '~/src/config/index.js'
import { failAction } from '~/src/helpers/fail-action.js'
import { requestLogger } from '~/src/helpers/logging/request-logger.js'
import { requestTracing } from '~/src/helpers/request-tracing.js'
import { client, db, locker, prepareDb } from '~/src/mongo.js'
import { auth } from '~/src/plugins/auth/index.js'
import { router } from '~/src/plugins/router.js'
import { scheduler } from '~/src/plugins/scheduler.js'
import { prepareSecureContext } from '~/src/secure-context.js'
import { setupProxy } from '~/src/utils/setup-proxy.js'

const isProduction = config.get('isProduction')

/**
 * Creates the Hapi server
 */
export async function createServer() {
  setupProxy()

  const server = hapi.server({
    port: config.get('port'),
    routes: {
      auth: {
        mode: 'required'
      },
      validate: {
        options: {
          abortEarly: false
        },
        failAction
      },
      files: {
        relativeTo: path.resolve(config.get('root'), '.public')
      },
      security: {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        },
        xss: 'enabled',
        noSniff: true,
        xframe: true
      }
    },
    router: {
      stripTrailingSlash: true
    }
  })

  await server.register(auth)
  await server.register(requestLogger)
  await server.register(requestTracing)

  if (isProduction) {
    prepareSecureContext(server)
  }

  await prepareDb(server.logger)

  server.decorate('server', 'mongoClient', client)
  server.decorate('server', 'db', db)
  server.decorate('server', 'locker', /** @type {any} */ (locker.locker))
  server.decorate('request', 'db', () => db, { apply: true })
  server.decorate(
    'request',
    'locker',
    () => /** @type {any} */ (locker.locker),
    { apply: true }
  )

  server.events.on('stop', () => {
    server.logger.info('Closing Mongo client')
    try {
      const closeResult = client.close(true)
      // In production, this returns a Promise; in tests, it might not
      Promise.resolve(closeResult).catch((/** @type {unknown} */ err) => {
        server.logger.error(err, 'Failed to close mongo client')
      })
    } catch (err) {
      server.logger.error(err, 'Error during client close')
    }
  })

  await server.register(router)
  await server.register(scheduler)

  return server
}
