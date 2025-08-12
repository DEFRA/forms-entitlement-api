import cron from 'node-cron'

import { config } from '~/src/config/index.js'
import { getErrorMessage } from '~/src/helpers/error-message.js'
import { createLogger } from '~/src/helpers/logging/logger.js'

const logger = createLogger()

/**
 * Scheduler service for managing periodic tasks
 */
class SchedulerService {
  /**
   * Create scheduler service instance
   */
  constructor() {
    this.tasks = new Map()
    this.isInitialized = false
    // Scheduler service initialized
  }

  /**
   * Schedule a recurring task
   * @param {string} name - Unique name for the task
   * @param {string} cronExpression - Cron expression for scheduling
   * @param {Function} taskFunction - Function to execute
   * @param {boolean} runImmediately - Whether to run the task immediately on startup
   * @returns {boolean} True if task was scheduled successfully
   */
  scheduleTask(name, cronExpression, taskFunction, runImmediately = false) {
    try {
      if (this.tasks.has(name)) {
        logger.warn(
          `[SchedulerService] Task '${name}' already exists, skipping`
        )
        return false
      }

      if (!cron.validate(cronExpression)) {
        logger.error(
          `[SchedulerService] Invalid cron expression for task '${name}': ${cronExpression}`
        )
        return false
      }

      const executeScheduledTask = async () => {
        try {
          await taskFunction()
        } catch (error) {
          logger.error(
            `[SchedulerService] Task '${name}' failed: ${getErrorMessage(error)}`
          )
        }
      }

      const task = cron.schedule(cronExpression, executeScheduledTask, {
        timezone: 'UTC'
      })

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      task.stop()

      this.tasks.set(name, {
        task,
        cronExpression,
        taskFunction: executeScheduledTask,
        isRunning: false
      })

      if (runImmediately) {
        setImmediate(() => {
          executeScheduledTask().catch((/** @type {unknown} */ err) => {
            logger.error(
              `[SchedulerService] Immediate task execution failed: ${getErrorMessage(err)}`
            )
          })
        })
      }

      return true
    } catch (error) {
      logger.error(
        `[SchedulerService] Failed to schedule task '${name}': ${getErrorMessage(error)}`
      )
      return false
    }
  }

  /**
   * Start all scheduled tasks
   */
  start() {
    if (this.isInitialized) {
      logger.warn('[SchedulerService] Scheduler already started')
      return
    }

    logger.info(
      `[SchedulerService] Starting scheduler with ${this.tasks.size} tasks`
    )

    for (const [name, taskData] of this.tasks) {
      try {
        taskData.task.start()
        taskData.isRunning = true
      } catch (error) {
        logger.error(
          `[SchedulerService] Failed to start task '${name}': ${getErrorMessage(error)}`
        )
      }
    }

    this.isInitialized = true
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    if (!this.isInitialized) {
      logger.warn('[SchedulerService] Scheduler not running')
      return
    }

    logger.info(
      `[SchedulerService] Stopping scheduler with ${this.tasks.size} tasks`
    )

    for (const [name, taskData] of this.tasks) {
      try {
        taskData.task.stop()
        taskData.isRunning = false
      } catch (error) {
        logger.error(
          `[SchedulerService] Failed to stop task '${name}': ${getErrorMessage(error)}`
        )
      }
    }

    this.isInitialized = false
  }

  /**
   * Manually trigger a task
   * @param {string} name - Name of the task to trigger
   * @returns {Promise<boolean>} True if task was triggered successfully
   */
  async triggerTask(name) {
    const taskData = this.tasks.get(name)
    if (!taskData) {
      logger.error(`[SchedulerService] Task '${name}' not found`)
      return false
    }

    try {
      await taskData.taskFunction()
      return true
    } catch (error) {
      logger.error(
        `[SchedulerService] Failed to trigger task '${name}': ${getErrorMessage(error)}`
      )
      return false
    }
  }
}

let schedulerService = null

/**
 * Get the scheduler service instance
 * @returns {SchedulerService} The scheduler service instance
 */
export function getSchedulerService() {
  schedulerService ??= new SchedulerService()
  return schedulerService
}

/**
 * Initialise and configure the admin user sync scheduler
 * @param {Function} syncFunction - The sync function to schedule
 * @returns {SchedulerService|null} The scheduler service instance or null if sync is disabled
 */
export function initialiseAdminUserSync(syncFunction) {
  const scheduler = getSchedulerService()

  const syncEnabled = config.get('sync.adminUsers.enabled')
  const cronSchedule = config.get('sync.adminUsers.cronSchedule')

  if (!syncEnabled) {
    return null
  }

  const success = scheduler.scheduleTask(
    'admin-user-sync',
    cronSchedule,
    syncFunction,
    true
  )

  if (!success) {
    logger.error('[SchedulerService] Failed to schedule admin user sync task')
    throw new Error('Failed to initialize admin user sync scheduler')
  }

  return scheduler
}
