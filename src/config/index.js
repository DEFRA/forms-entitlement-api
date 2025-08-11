import { cwd } from 'process'

import 'dotenv/config'
import convict from 'convict'

const isProduction = process.env.NODE_ENV === 'production'
const isDev = process.env.NODE_ENV !== 'production'
const isTest = process.env.NODE_ENV === 'test'

export const config = convict({
  env: {
    doc: 'The application environment.',
    format: ['production', 'development', 'test'],
    default: 'development',
    env: 'NODE_ENV'
  },
  host: {
    doc: 'The IP address to bind',
    format: String,
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 3004,
    env: 'PORT'
  },
  serviceName: {
    doc: 'Api Service Name',
    format: String,
    default: 'forms-entitlement-api'
  },
  serviceVersion: /** @satisfies {SchemaObj<string | null>} */ ({
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  }),
  cdpEnvironment: {
    doc: 'The CDP environment the app is running in. With the addition of "local" for local development',
    format: ['local', 'dev', 'test', 'perf-test', 'prod'],
    default: 'local',
    env: 'ENVIRONMENT'
  },
  root: {
    doc: 'Project root',
    format: String,
    default: cwd()
  },
  isProduction: {
    doc: 'If this application running in the production environment',
    format: Boolean,
    default: isProduction
  },
  isDevelopment: {
    doc: 'If this application running in the development environment',
    format: Boolean,
    default: isDev
  },
  isTest: {
    doc: 'If this application running in the test environment',
    format: Boolean,
    default: isTest
  },
  log: {
    enabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: !isTest,
      env: 'LOG_ENABLED'
    },
    level: /** @type {SchemaObj<LevelWithSilent>} */ ({
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    }),
    format: /** @type {SchemaObj<'ecs' | 'pino-pretty'>} */ ({
      doc: 'Format to output logs in.',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    }),
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : ['req', 'res', 'responseTime']
    }
  },
  mongo: {
    uri: {
      doc: 'URI for mongodb',
      format: String,
      default: 'mongodb://127.0.0.1:27017/',
      env: 'MONGO_URI'
    },
    databaseName: {
      doc: 'Database name for mongodb',
      format: String,
      default: 'forms-entitlement-api',
      env: 'MONGO_DATABASE'
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  httpsProxy: {
    doc: 'HTTPS Proxy',
    format: String,
    default: '',
    env: 'CDP_HTTPS_PROXY'
  },
  isSecureContextEnabled: {
    doc: 'Enable Secure Context',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_SECURE_CONTEXT'
  },
  isMetricsEnabled: {
    doc: 'Enable metrics reporting',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_METRICS'
  },
  /**
   * @todo We plan to replace `node-convict` with `joi` and remove all defaults.
   * These OIDC/roles are for the DEV application in the DEFRA tenant.
   */
  oidcJwksUri: {
    doc: 'The URI that defines the OIDC json web key set',
    format: String,
    default:
      'https://login.microsoftonline.com/6f504113-6b64-43f2-ade9-242e05780007/discovery/v2.0/keys',
    env: 'OIDC_JWKS_URI'
  },
  oidcVerifyAud: {
    doc: 'The audience used for verifying the OIDC JWT',
    format: String,
    default: '6be2d9fd-fe1e-47eb-9821-b6f6cd3ceba1',
    env: 'OIDC_VERIFY_AUD'
  },
  oidcVerifyIss: {
    doc: 'The issuer used for verifying the OIDC JWT',
    format: String,
    default:
      'https://login.microsoftonline.com/6f504113-6b64-43f2-ade9-242e05780007/v2.0',
    env: 'OIDC_VERIFY_ISS'
  },
  roleEditorGroupId: {
    doc: 'The AD security group the access token needs to claim membership of',
    format: String,
    default: '7049296f-2156-4d61-8ac3-349276438ef9',
    env: 'ROLE_EDITOR_GROUP_ID'
  },
  azure: {
    clientId: {
      doc: 'Azure AD application client ID for Graph API access',
      format: String,
      default: '5aba38f7-c4d0-4003-933c-d727b2209c0e',
      env: 'AZURE_CLIENT_ID'
    },
    clientSecret: {
      doc: 'Azure AD application client secret for Graph API access',
      format: String,
      default: '',
      env: 'AZURE_CLIENT_SECRET',
      sensitive: true
    },
    tenantId: {
      doc: 'Azure AD tenant ID',
      format: String,
      default: '6f504113-6b64-43f2-ade9-242e05780007',
      env: 'AZURE_TENANT_ID'
    }
  },
  tracing: {
    header: {
      doc: 'CDP tracing header name',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  },
  awsRegion: {
    doc: 'AWS region',
    format: String,
    default: 'eu-west-2',
    env: 'AWS_REGION'
  },
  snsEndpoint: {
    doc: 'The SNS endpoint, if required (e.g. a local development dev service)',
    format: String,
    default: '',
    env: 'SNS_ENDPOINT'
  },
  snsTopicArn: {
    doc: 'SNS topic ARN',
    format: String,
    default: '',
    env: 'SNS_TOPIC_ARN'
  },
  publishAuditEvents: {
    doc: 'Publish audit events for forms-audit-api',
    format: Boolean,
    default: !isProduction,
    env: 'FEATURE_FLAG_PUBLISH_AUDIT_EVENTS'
  }
})

config.validate({ allowed: 'strict' })

/**
 * @import { SchemaObj } from 'convict'
 * @import { LevelWithSilent } from 'pino'
 */
