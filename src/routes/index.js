import health from '~/src/routes/health.js'
import migration from '~/src/routes/migration.js'
import user from '~/src/routes/user.js'

export default [health, user, migration].flat()
