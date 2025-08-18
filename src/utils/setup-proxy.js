import Wreck from '@hapi/wreck'
import { bootstrap } from 'global-agent'
import { ProxyAgent } from 'proxy-agent'
import { ProxyAgent as ProxyAgentUndici, setGlobalDispatcher } from 'undici'

import { config } from '~/src/config/index.js'
import { createLogger } from '~/src/helpers/logging/logger.js'
const logger = createLogger()

/**
 * If HTTP_PROXY is set setupProxy() will enable it globally
 * for a number of http clients.
 * Node Fetch will still need to pass a ProxyAgent in on each call.
 */
export const setupProxy = () => {
  const proxyUrl = config.get('httpProxy')

  // patch well known libraries to use the proxy. These are typically used by libraries, rather than our preferred API client (Wreck).
  if (proxyUrl) {
    logger.info('setting up global proxies')

    // Undici proxy
    setGlobalDispatcher(new ProxyAgentUndici(proxyUrl))

    // global-agent (axios/request/and others)
    bootstrap()

    // @ts-expect-error GLOBAL_AGENT is not part of the global type definitions
    global.GLOBAL_AGENT.HTTP_PROXY = proxyUrl
  }

  // handles HTTP_PROXY/HTTPS_PROXY internally, the above if statement is not needed for this library
  // this is our preferred API client
  setupWreckProxy()
}

/**
 * Sets up Wreck to use a proxy agent
 */
function setupWreckProxy() {
  logger.info('setting up wreck global proxies')

  const proxyAgent = new ProxyAgent()

  Wreck.agents = {
    https: proxyAgent,
    http: proxyAgent,
    httpsAllowUnauthorized: proxyAgent
  }
}
