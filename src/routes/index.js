import health from '~/src/routes/health.js'
import scheduler from '~/src/routes/scheduler.js'
import user from '~/src/routes/user.js'

export default [health, user, scheduler].flat()
