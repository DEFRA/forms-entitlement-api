import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import cron from 'node-cron'

import { config } from '~/src/config/index.js'
import {
  getSchedulerService,
  initialiseAdminUserSync
} from '~/src/services/scheduler.js'

const createMockTask = () => ({
  start: jest.fn(),
  stop: jest.fn()
})

jest.mock('node-cron', () => ({
  default: {
    validate: jest.fn(),
    schedule: jest.fn()
  }
}))

jest.mock('~/src/config/index.js', () => ({
  config: {
    get: jest.fn()
  }
}))

jest.mock('~/src/helpers/logging/logger.js', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}))

jest.mock('~/src/helpers/error-message.js', () => ({
  getErrorMessage: (/** @type {{ message: string; }} */ error) =>
    error instanceof Error ? error.message : error
}))

describe('SchedulerService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    const mockTasks = /** @type {any[]} */ ([])
    const cronAny = /** @type {any} */ (cron)
    const configAny = /** @type {any} */ (config)

    cronAny.validate = jest.fn().mockReturnValue(true)
    cronAny.schedule = jest.fn().mockImplementation(() => {
      const task = createMockTask()
      mockTasks.push(task)
      return task
    })

    configAny.get = jest.fn().mockImplementation((key) => {
      if (key === 'sync.adminUsers.enabled') return true
      if (key === 'sync.adminUsers.cronSchedule') return '0 */6 * * *'
      return undefined
    })

    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
    const scheduler = getSchedulerService()
    scheduler.tasks.clear()
    scheduler.isInitialized = false
  })

  describe('scheduleTask', () => {
    test('should schedule a task successfully', () => {
      const scheduler = getSchedulerService()
      const taskFunction = jest.fn()
      const result = scheduler.scheduleTask(
        'test-task',
        '* * * * *',
        taskFunction
      )

      expect(result).toBe(true)
      expect(cron.validate).toHaveBeenCalledWith('* * * * *')
      expect(cron.schedule).toHaveBeenCalled()
      expect(scheduler.tasks.has('test-task')).toBe(true)
    })

    test('should reject duplicate task names', () => {
      const scheduler = getSchedulerService()
      const taskFunction = jest.fn()
      scheduler.scheduleTask('duplicate-task', '* * * * *', taskFunction)

      const result = scheduler.scheduleTask(
        'duplicate-task',
        '* * * * *',
        taskFunction
      )

      expect(result).toBe(false)
      expect(scheduler.tasks.size).toBe(1)
    })

    test('should reject invalid cron expressions', () => {
      const scheduler = getSchedulerService()
      const cronAny = /** @type {any} */ (cron)
      cronAny.validate.mockReturnValue(false)

      const taskFunction = jest.fn()
      const result = scheduler.scheduleTask(
        'invalid-cron',
        'invalid',
        taskFunction
      )

      expect(result).toBe(false)
      expect(scheduler.tasks.has('invalid-cron')).toBe(false)
    })

    test('should run task immediately when runImmediately is true', () => {
      const scheduler = getSchedulerService()
      const taskFunction = jest.fn().mockImplementation(() => Promise.resolve())
      scheduler.scheduleTask('immediate-task', '* * * * *', taskFunction, true)

      jest.runAllTimers()

      const taskData = scheduler.tasks.get('immediate-task')
      expect(taskData).toBeDefined()
      expect(taskData.taskFunction).toBeDefined()
    })

    test('should handle task execution errors', async () => {
      const scheduler = getSchedulerService()
      const taskFunction = jest
        .fn()
        .mockImplementation(() => Promise.reject(new Error('Task error')))
      scheduler.scheduleTask('error-task', '* * * * *', taskFunction)

      const taskData = scheduler.tasks.get('error-task')
      expect(taskData).toBeDefined()

      await taskData.taskFunction()

      expect(taskFunction).toHaveBeenCalled()
    })

    test('should handle task execution with non-Error objects', async () => {
      const scheduler = getSchedulerService()
      const taskFunction = jest.fn().mockImplementation(() => {
        // Testing scheduler handles non-Error rejection values
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject('String error')
      })
      scheduler.scheduleTask('string-error-task', '* * * * *', taskFunction)

      const taskData = scheduler.tasks.get('string-error-task')
      expect(taskData).toBeDefined()

      await taskData.taskFunction()

      expect(taskFunction).toHaveBeenCalled()
    })

    test('should handle task execution with statusCode error', async () => {
      const scheduler = getSchedulerService()
      const error = new Error('HTTP Error')
      Object.assign(error, { statusCode: 404 })
      const taskFunction = jest
        .fn()
        .mockImplementation(() => Promise.reject(error))
      scheduler.scheduleTask('http-error-task', '* * * * *', taskFunction)

      const taskData = scheduler.tasks.get('http-error-task')
      expect(taskData).toBeDefined()

      await taskData.taskFunction()

      expect(taskFunction).toHaveBeenCalled()
    })

    test('should handle schedule creation errors', () => {
      const scheduler = getSchedulerService()
      const cronAny = /** @type {any} */ (cron)
      cronAny.schedule.mockImplementation(() => {
        throw new Error('Schedule creation failed')
      })

      const taskFunction = jest.fn()
      const result = scheduler.scheduleTask(
        'failed-schedule',
        '* * * * *',
        taskFunction
      )

      expect(result).toBe(false)
      expect(scheduler.tasks.has('failed-schedule')).toBe(false)
    })

    test('should handle immediate task execution errors', () => {
      const scheduler = getSchedulerService()
      const taskFunction = jest
        .fn()
        .mockImplementation(() => Promise.reject(new Error('Immediate error')))
      scheduler.scheduleTask('immediate-error', '* * * * *', taskFunction, true)

      jest.runAllTimers()

      const taskData = scheduler.tasks.get('immediate-error')
      expect(taskData).toBeDefined()
    })

    test('should log task completion on success', async () => {
      const scheduler = getSchedulerService()
      const taskFunction = jest.fn().mockImplementation(() => Promise.resolve())
      scheduler.scheduleTask('success-task', '* * * * *', taskFunction)

      const taskData = scheduler.tasks.get('success-task')
      await taskData.taskFunction()

      expect(taskFunction).toHaveBeenCalled()
    })
  })

  describe('start', () => {
    test('should start all scheduled tasks', () => {
      const scheduler = getSchedulerService()
      const taskFunction1 = jest.fn()
      const taskFunction2 = jest.fn()

      scheduler.scheduleTask('task1', '* * * * *', taskFunction1)
      scheduler.scheduleTask('task2', '*/5 * * * *', taskFunction2)

      scheduler.start()

      expect(scheduler.isInitialized).toBe(true)

      const task1Data = scheduler.tasks.get('task1')
      const task2Data = scheduler.tasks.get('task2')
      expect(task1Data.isRunning).toBe(true)
      expect(task2Data.isRunning).toBe(true)
      expect(task1Data.task.start).toHaveBeenCalled()
      expect(task2Data.task.start).toHaveBeenCalled()
    })

    test('should not start if already initialized', () => {
      const scheduler = getSchedulerService()
      scheduler.isInitialized = true

      const taskFunction = jest.fn()
      scheduler.scheduleTask('test-task', '* * * * *', taskFunction)
      const taskData = scheduler.tasks.get('test-task')

      scheduler.start()

      expect(taskData.task.start).not.toHaveBeenCalled()
    })

    test('should handle task start errors', () => {
      const scheduler = getSchedulerService()
      const mockTask = createMockTask()
      mockTask.start.mockImplementation(() => {
        throw new Error('Start failed')
      })
      const cronAny = /** @type {any} */ (cron)
      cronAny.schedule.mockReturnValue(mockTask)

      const taskFunction = jest.fn()
      scheduler.scheduleTask('failed-start', '* * * * *', taskFunction)

      scheduler.start()

      expect(scheduler.isInitialized).toBe(true)
    })
  })

  describe('stop', () => {
    test('should stop all scheduled tasks', () => {
      const scheduler = getSchedulerService()
      const taskFunction1 = jest.fn()
      const taskFunction2 = jest.fn()

      scheduler.scheduleTask('task1', '* * * * *', taskFunction1)
      scheduler.scheduleTask('task2', '*/5 * * * *', taskFunction2)
      scheduler.start()

      scheduler.stop()

      expect(scheduler.isInitialized).toBe(false)

      const task1Data = scheduler.tasks.get('task1')
      const task2Data = scheduler.tasks.get('task2')
      expect(task1Data.isRunning).toBe(false)
      expect(task2Data.isRunning).toBe(false)
      expect(task1Data.task.stop).toHaveBeenCalledTimes(2)
      expect(task2Data.task.stop).toHaveBeenCalledTimes(2)
    })

    test('should not stop if not initialized', () => {
      const scheduler = getSchedulerService()
      scheduler.isInitialized = false

      const taskFunction = jest.fn()
      scheduler.scheduleTask('test-task', '* * * * *', taskFunction)
      const taskData = scheduler.tasks.get('test-task')

      taskData.task.stop.mockClear()
      scheduler.stop()

      expect(taskData.task.stop).not.toHaveBeenCalled()
    })

    test('should handle task stop errors', () => {
      const scheduler = getSchedulerService()
      const mockTask = createMockTask()
      let stopCallCount = 0
      mockTask.stop.mockImplementation(() => {
        stopCallCount++
        if (stopCallCount > 1) {
          throw new Error('Stop failed')
        }
      })
      const cronAny = /** @type {any} */ (cron)
      cronAny.schedule.mockReturnValue(mockTask)

      const taskFunction = jest.fn()
      scheduler.scheduleTask('failed-stop', '* * * * *', taskFunction)
      scheduler.start()

      scheduler.stop()

      expect(scheduler.isInitialized).toBe(false)
    })
  })

  describe('triggerTask', () => {
    test('should trigger a task manually', async () => {
      const scheduler = getSchedulerService()
      const taskFunction = jest.fn().mockImplementation(() => Promise.resolve())
      scheduler.scheduleTask('manual-task', '* * * * *', taskFunction)

      const result = await scheduler.triggerTask('manual-task')

      expect(result).toBe(true)
      expect(taskFunction).toHaveBeenCalledTimes(1)
    })

    test('should return false for non-existent task', async () => {
      const scheduler = getSchedulerService()
      const result = await scheduler.triggerTask('non-existent')

      expect(result).toBe(false)
    })

    test('should handle task trigger errors', async () => {
      const scheduler = getSchedulerService()
      const taskFunction = jest
        .fn()
        .mockImplementation(() => Promise.reject(new Error('Trigger error')))
      scheduler.scheduleTask('trigger-error', '* * * * *', taskFunction)

      const result = await scheduler.triggerTask('trigger-error')

      expect(result).toBe(true)
      expect(taskFunction).toHaveBeenCalledTimes(1)
    })
  })

  describe('getSchedulerService', () => {
    test('should return singleton instance', () => {
      const instance1 = getSchedulerService()
      const instance2 = getSchedulerService()

      expect(instance1).toBe(instance2)
    })
  })

  describe('initialiseAdminUserSync', () => {
    test('should initialise admin user sync when enabled', () => {
      const syncFunction = jest.fn()
      const result = initialiseAdminUserSync(syncFunction)

      expect(result).toBeDefined()
      expect(config.get).toHaveBeenCalledWith('sync.adminUsers.enabled')
      expect(config.get).toHaveBeenCalledWith('sync.adminUsers.cronSchedule')

      const scheduler = getSchedulerService()
      expect(scheduler.tasks.has('admin-user-sync')).toBe(true)
    })

    test('should not initialise when sync is disabled', () => {
      const configAny = /** @type {any} */ (config)
      configAny.get.mockImplementation((/** @type {any} */ key) => {
        if (key === 'sync.adminUsers.enabled') return false
        if (key === 'sync.adminUsers.cronSchedule') return '0 */6 * * *'
        return undefined
      })

      const syncFunction = jest.fn()
      const result = initialiseAdminUserSync(syncFunction)

      expect(result).toBeNull()
    })

    test('should throw error when scheduling fails', () => {
      const cronAny = /** @type {any} */ (cron)
      cronAny.validate.mockReturnValue(false)

      const syncFunction = jest.fn()
      expect(() => initialiseAdminUserSync(syncFunction)).toThrow(
        'Failed to initialize admin user sync scheduler'
      )
    })
  })
})
