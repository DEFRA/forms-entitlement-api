import { requestTracing as requestTracingPlugin } from '@defra/forms-common'
import { tracing } from '@defra/hapi-tracing'

import { config } from '~/src/config/index.js'

/**
 * Gets the unique ID (`oid`) of the authenticated user
 * @param {Request} request
 * @returns {string | undefined}
 */
export function getRequestUserId(request) {
  const { credentials, isAuthenticated } = request.auth

  if (!isAuthenticated) {
    return undefined
  }

  return credentials.user?.oid
}

/**
 * Starts a log context for every request, holding the correlation ID from the
 * tracing header (or a new ID when the caller sent none), the ID of the
 * authenticated user, and the session ID and form reference number sent by
 * the calling forms service. The logger writes them on every log line.
 * Messages published while the request is handled carry them on.
 * @satisfies {ServerRegisterPluginObject<RequestTracingOptions>}
 */
export const requestTracing = {
  plugin: requestTracingPlugin,
  options: {
    tracingHeader: config.get('tracing.header'),
    tracingPlugin: tracing.plugin,
    getUserId: getRequestUserId,
    readLogContextHeaders: true
  }
}

/**
 * @import { RequestTracingOptions } from '@defra/forms-common'
 * @import { Request, ServerRegisterPluginObject } from '@hapi/hapi'
 */
