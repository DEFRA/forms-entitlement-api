process.env.NODE_ENV = 'test'
process.env.HOST = '0.0.0.0'
process.env.PORT = '3004'
process.env.SERVICE_VERSION = 'test'
process.env.ENVIRONMENT = 'test'

process.env.LOG_ENABLED = 'false'
process.env.LOG_LEVEL = 'debug'
process.env.LOG_FORMAT = 'pino-pretty'

process.env.MONGO_URI =
  'mongodb://localhost:27017/?replicaSet=rs0&directConnection=true'
process.env.MONGO_DATABASE = 'forms-entitlement-api'

process.env.HTTP_PROXY = ''
process.env.CDP_HTTPS_PROXY = ''

process.env.ENABLE_SECURE_CONTEXT = 'false'
process.env.ENABLE_METRICS = 'false'

process.env.OIDC_JWKS_URI =
  'http://localhost:5556/.well-known/openid-configuration/jwks'
process.env.OIDC_VERIFY_AUD = 'local-test-client'
process.env.OIDC_VERIFY_ISS = 'http://oidc:80'
process.env.ROLE_EDITOR_GROUP_ID = '5b8a0214-74d3-4bf0-b665-102511c967b2'

process.env.AZURE_CLIENT_ID = 'local-test-client'
process.env.AZURE_CLIENT_SECRET = 'local-mock-secret'
process.env.AZURE_TENANT_ID = '6f504113-6b64-43f2-ade9-242e05780007'
process.env.SYNC_ADMIN_USERS_ENABLED = 'false'
process.env.SYNC_ADMIN_USERS_CRON = '0 */6 * * *'

process.env.TRACING_HEADER = 'x-cdp-request-id'
process.env.AWS_REGION = 'eu-west-2'
process.env.SNS_ENDPOINT = 'http://localhost:4566'
process.env.SNS_TOPIC_ARN =
  'arn:aws:sns:eu-west-2:000000000000:forms_entitlement_events'

process.env.AWS_ACCESS_KEY_ID = 'dummy'
process.env.AWS_SECRET_ACCESS_KEY = 'dummy'
