import path from 'path'

import hapi from '@hapi/hapi'
import Wreck from '@hapi/wreck'
import { ProxyAgent } from 'proxy-agent'

import { config } from '~/src/config/index.js'
import { failAction } from '~/src/helpers/fail-action.js'
import { requestLogger } from '~/src/helpers/logging/request-logger.js'
import { requestTracing } from '~/src/helpers/request-tracing.js'
import { client, db, locker, prepareDb } from '~/src/mongo.js'
import { auth } from '~/src/plugins/auth/index.js'
import { router } from '~/src/plugins/router.js'
import { scheduler } from '~/src/plugins/scheduler.js'
import { prepareSecureContext } from '~/src/secure-context.js'

const isProduction = config.get('isProduction')

const proxyAgent = new ProxyAgent()

Wreck.agents = {
  https: proxyAgent,
  http: proxyAgent,
  httpsAllowUnauthorized: proxyAgent
}

/**
 * Creates the Hapi server
 */
export async function createServer() {
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
  server.decorate('server', 'locker', locker)
  server.decorate('request', 'db', () => db, { apply: true })
  server.decorate('request', 'locker', () => locker, { apply: true })

  server.events.on('stop', () => {
    server.logger.info('Closing Mongo client')
    try {
      const closeResult = client.close(true)
      // In production, this returns a Promise; in tests, it might not
      Promise.resolve(closeResult).catch((/** @type {unknown} */ e) => {
        server.logger.error(e, 'Failed to close mongo client')
      })
    } catch (error) {
      server.logger.error(error, 'Error during client close')
    }
  })

  await server.register(router)
  await server.register(scheduler)

  return server
}
