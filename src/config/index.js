import { cwd } from 'node:process'

import 'dotenv/config'
import convict from 'convict'

const isProduction = process.env.NODE_ENV === 'production'
const isDev = process.env.NODE_ENV !== 'production'
const isTest = process.env.NODE_ENV === 'test'

export const config = convict({
  /**@type {SchemaObj<string>} */
  env: {
    doc: 'The application environment.',
    format: ['production', 'development', 'test'],
    default: null,
    env: 'NODE_ENV'
  },
  /**@type {SchemaObj<string>} */
  host: {
    doc: 'The IP address to bind',
    format: String,
    default: null,
    env: 'HOST'
  },
  /**@type {SchemaObj<number>} */
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: null,
    env: 'PORT'
  },
  /**@type {SchemaObj<string>} */
  serviceName: {
    doc: 'Api Service Name',
    format: String,
    default: 'forms-entitlement-api'
  },
  /** @type {SchemaObj<string | null>} */
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  /**@type {SchemaObj<string>} */
  cdpEnvironment: {
    doc: 'The CDP environment the app is running in. With the addition of "local" for local development',
    format: ['local', 'dev', 'test', 'perf-test', 'ext-test', 'prod'],
    default: null,
    env: 'ENVIRONMENT'
  },
  /**@type {SchemaObj<string>} */
  root: {
    doc: 'Project root',
    format: String,
    default: cwd()
  },
  /**@type {SchemaObj<boolean>} */
  isProduction: {
    doc: 'If this application running in the production environment',
    format: Boolean,
    default: isProduction
  },
  /**@type {SchemaObj<boolean>} */
  isDevelopment: {
    doc: 'If this application running in the development environment',
    format: Boolean,
    default: isDev
  },
  /**@type {SchemaObj<boolean>} */
  isTest: {
    doc: 'If this application running in the test environment',
    format: Boolean,
    default: isTest
  },
  log: {
    /**@type {SchemaObj<boolean>} */
    enabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: null,
      env: 'LOG_ENABLED'
    },
    /** @type {SchemaObj<LevelWithSilent>} */
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: null,
      env: 'LOG_LEVEL'
    },
    /** @type {SchemaObj<'ecs' | 'pino-pretty'>} */
    format: {
      doc: 'Format to output logs in.',
      format: ['ecs', 'pino-pretty'],
      default: null,
      env: 'LOG_FORMAT'
    },
    /**@type {SchemaObj<string[]>} */
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : ['req', 'res', 'responseTime']
    }
  },
  mongo: {
    /**@type {SchemaObj<string>} */
    uri: {
      doc: 'URI for mongodb',
      format: String,
      default: null,
      env: 'MONGO_URI'
    },
    /**@type {SchemaObj<string>} */
    databaseName: {
      doc: 'Database name for mongodb',
      format: String,
      default: null,
      env: 'MONGO_DATABASE'
    }
  },
  /** @type {SchemaObj<string | null>} */
  httpProxy: {
    doc: 'HTTP Proxy',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  /** @type {SchemaObj<string>} */
  httpsProxy: {
    doc: 'HTTPS Proxy',
    format: String,
    default: null,
    env: 'CDP_HTTPS_PROXY'
  },
  /** @type {SchemaObj<boolean>} */
  isSecureContextEnabled: {
    doc: 'Enable Secure Context',
    format: Boolean,
    default: null,
    env: 'ENABLE_SECURE_CONTEXT'
  },
  /** @type {SchemaObj<boolean>} */
  isMetricsEnabled: {
    doc: 'Enable metrics reporting',
    format: Boolean,
    default: null,
    env: 'ENABLE_METRICS'
  },
  /**
   * These OIDC/roles are for the DEV application in the DEFRA tenant.
   */
  /** @type {SchemaObj<string>} */
  oidcJwksUri: {
    doc: 'The URI that defines the OIDC json web key set',
    format: String,
    default: null,
    env: 'OIDC_JWKS_URI'
  },
  /** @type {SchemaObj<string>} */
  oidcVerifyAud: {
    doc: 'The audience used for verifying the OIDC JWT',
    format: String,
    default: null,
    env: 'OIDC_VERIFY_AUD'
  },
  /** @type {SchemaObj<string>} */
  oidcVerifyIss: {
    doc: 'The issuer used for verifying the OIDC JWT',
    format: String,
    default: null,
    env: 'OIDC_VERIFY_ISS'
  },
  /** @type {SchemaObj<string>} */
  roleEditorGroupId: {
    doc: 'The AD security group the access token needs to claim membership of',
    format: String,
    default: null,
    env: 'ROLE_EDITOR_GROUP_ID'
  },
  azure: {
    /** @type {SchemaObj<string>} */
    clientId: {
      doc: 'Azure AD application client ID for Graph API access',
      format: String,
      default: null,
      env: 'AZURE_CLIENT_ID'
    },
    /** @type {SchemaObj<string>} */
    clientSecret: {
      doc: 'Azure AD application client secret for Graph API access',
      format: String,
      default: null,
      env: 'AZURE_CLIENT_SECRET',
      sensitive: true
    },
    /** @type {SchemaObj<string>} */
    tenantId: {
      doc: 'Azure AD tenant ID',
      format: String,
      default: null,
      env: 'AZURE_TENANT_ID'
    }
  },
  tracing: {
    /** @type {SchemaObj<string>} */
    header: {
      doc: 'CDP tracing header name',
      format: String,
      default: null,
      env: 'TRACING_HEADER'
    }
  },
  /** @type {SchemaObj<string>} */
  awsRegion: {
    doc: 'AWS region',
    format: String,
    default: null,
    env: 'AWS_REGION'
  },
  /** @type {SchemaObj<string>} */
  snsEndpoint: {
    doc: 'The SNS endpoint, if required (e.g. a local development dev service)',
    format: String,
    default: null,
    env: 'SNS_ENDPOINT'
  },
  /** @type {SchemaObj<string>} */
  snsTopicArn: {
    doc: 'SNS topic ARN',
    format: String,
    default: null,
    env: 'SNS_TOPIC_ARN'
  },
  sync: {
    adminUsers: {
      /** @type {SchemaObj<boolean>} */
      enabled: {
        doc: 'Enable periodic admin user sync from Azure AD group',
        format: Boolean,
        default: null,
        env: 'SYNC_ADMIN_USERS_ENABLED'
      },
      /** @type {SchemaObj<string>} */
      cronSchedule: {
        doc: 'Cron schedule for admin user sync (default: every 6 hours)',
        format: String,
        default: null,
        env: 'SYNC_ADMIN_USERS_CRON'
      }
    }
  }
})

config.validate({ allowed: 'strict' })

/**
 * @import { SchemaObj } from 'convict'
 * @import { LevelWithSilent } from 'pino'
 */
