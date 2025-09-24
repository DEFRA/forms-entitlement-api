const mockErrorFn = jest.fn()
const mockWarnFn = jest.fn()
const mockInfoFn = jest.fn()

jest.mock('~/src/helpers/logging/logger.js', () => ({
  createLogger: jest.fn().mockReturnValue({
    error: mockErrorFn,
    warn: mockWarnFn,
    info: mockInfoFn
  })
}))

const mockInitialiseAdminUserSync = jest.fn()
jest.mock('~/src/services/scheduler.js', () => ({
  initialiseAdminUserSync: mockInitialiseAdminUserSync
}))

const mockSyncAdminUsersFromGroup = jest.fn()
jest.mock('~/src/services/user.js', () => ({
  syncAdminUsersFromGroup: mockSyncAdminUsersFromGroup
}))

const mockGetErrorMessage = jest.fn()
jest.mock('~/src/helpers/error-message.js', () => ({
  getErrorMessage: mockGetErrorMessage
}))

describe('scheduler plugin', () => {
  /** @type {SchedulerModule} */
  let schedulerModule
  /** @type {Scheduler} */
  let scheduler

  const mockSchedulerService = {
    start: jest.fn(),
    stop: jest.fn()
  }

  const server = {
    app: /** @type {any} */ ({}),
    logger: {
      error: mockErrorFn,
      info: mockInfoFn
    },
    events: {
      on: jest.fn()
    }
  }

  beforeEach(async () => {
    jest.resetModules()
    jest.clearAllMocks()

    schedulerModule = await import('~/src/plugins/scheduler.js')
    scheduler = schedulerModule.scheduler
  })

  describe('plugin registration', () => {
    test('should have correct plugin metadata', () => {
      expect(scheduler.plugin.name).toBe('scheduler')
      expect(scheduler.plugin.version).toBe('1.0.0')
    })

    test('should successfully register when scheduler is enabled', () => {
      mockInitialiseAdminUserSync.mockReturnValue(mockSchedulerService)

      scheduler.plugin.register(/** @type {any} */ (server))

      expect(mockInitialiseAdminUserSync).toHaveBeenCalledWith(
        mockSyncAdminUsersFromGroup
      )

      expect(mockSchedulerService.start).toHaveBeenCalled()

      expect(server.app.scheduler).toBe(mockSchedulerService)

      expect(server.events.on).toHaveBeenCalledWith(
        'stop',
        expect.any(Function)
      )
    })

    test('should handle when scheduler is disabled via configuration', () => {
      mockInitialiseAdminUserSync.mockReturnValue(null)

      scheduler.plugin.register(/** @type {any} */ (server))

      expect(mockInitialiseAdminUserSync).toHaveBeenCalledWith(
        mockSyncAdminUsersFromGroup
      )

      expect(mockSchedulerService.start).not.toHaveBeenCalled()

      expect(server.app.scheduler).toBeNull()

      expect(mockInfoFn).toHaveBeenCalledWith(
        '[SchedulerPlugin] Scheduler disabled via configuration'
      )

      expect(server.events.on).not.toHaveBeenCalled()
    })

    test('should handle and rethrow initialization errors', () => {
      const testError = new Error('Initialization failed')
      mockInitialiseAdminUserSync.mockImplementation(() => {
        throw testError
      })
      mockGetErrorMessage.mockReturnValue('Initialization failed')

      server.app = /** @type {any} */ ({})

      expect(() => {
        scheduler.plugin.register(/** @type {any} */ (server))
      }).toThrow(testError)

      expect(mockErrorFn).toHaveBeenCalledWith(
        new Error('Initialization failed'),
        '[SchedulerPlugin] Failed to initialize scheduler: Initialization failed'
      )

      expect(server.app.scheduler).toBeUndefined()

      expect(server.events.on).not.toHaveBeenCalled()
    })
  })

  describe('server stop event handler', () => {
    test('should stop scheduler on server shutdown', () => {
      mockInitialiseAdminUserSync.mockReturnValue(mockSchedulerService)

      scheduler.plugin.register(/** @type {any} */ (server))

      expect(server.events.on).toHaveBeenCalledWith(
        'stop',
        expect.any(Function)
      )
      const stopHandler = server.events.on.mock.calls[0][1]

      mockInfoFn.mockClear()
      mockSchedulerService.stop.mockClear()

      stopHandler()

      expect(mockInfoFn).toHaveBeenCalledWith(
        '[SchedulerPlugin] Stopping scheduler due to server shutdown'
      )

      expect(mockSchedulerService.stop).toHaveBeenCalled()
    })

    test('should not register stop handler when scheduler is disabled', () => {
      mockInitialiseAdminUserSync.mockReturnValue(null)

      scheduler.plugin.register(/** @type {any} */ (server))

      expect(server.events.on).not.toHaveBeenCalled()
    })
  })

  describe('scheduler service integration', () => {
    test('should pass syncAdminUsersFromGroup function to initialiseAdminUserSync', () => {
      mockInitialiseAdminUserSync.mockReturnValue(mockSchedulerService)

      scheduler.plugin.register(/** @type {any} */ (server))

      expect(mockInitialiseAdminUserSync).toHaveBeenCalledTimes(1)
      expect(mockInitialiseAdminUserSync).toHaveBeenCalledWith(
        mockSyncAdminUsersFromGroup
      )
    })

    test('should handle scheduler service methods correctly', () => {
      const customSchedulerService = {
        start: jest.fn(),
        stop: jest.fn()
      }
      mockInitialiseAdminUserSync.mockReturnValue(customSchedulerService)

      scheduler.plugin.register(/** @type {any} */ (server))

      expect(customSchedulerService.start).toHaveBeenCalledTimes(1)

      const stopHandler = server.events.on.mock.calls[0][1]
      stopHandler()

      expect(customSchedulerService.stop).toHaveBeenCalledTimes(1)
    })
  })

  describe('error handling', () => {
    test('should handle getErrorMessage throwing an error', () => {
      const testError = new Error('Original error')
      mockInitialiseAdminUserSync.mockImplementation(() => {
        throw testError
      })
      const getErrorMessageError = new Error('getErrorMessage failed')
      mockGetErrorMessage.mockImplementation(() => {
        throw getErrorMessageError
      })

      expect(() => {
        scheduler.plugin.register(/** @type {any} */ (server))
      }).toThrow(getErrorMessageError)

      expect(mockGetErrorMessage).toHaveBeenCalledWith(testError)
    })

    test('should preserve original error when thrown', () => {
      const customError = new TypeError('Type error occurred')
      mockInitialiseAdminUserSync.mockImplementation(() => {
        throw customError
      })
      mockGetErrorMessage.mockReturnValue('Type error occurred')

      expect(() => {
        scheduler.plugin.register(/** @type {any} */ (server))
      }).toThrow(customError)

      expect(mockErrorFn).toHaveBeenCalledWith(
        new Error('Type error occurred'),
        '[SchedulerPlugin] Failed to initialize scheduler: Type error occurred'
      )
    })
  })
})

/**
 * @typedef {typeof SchedulerModuleDefinitionStar} SchedulerModule
 */
/**
 * @typedef {SchedulerTypeDefinition} Scheduler
 */

/**
 * @import * as SchedulerModuleDefinitionStar from '~/src/plugins/scheduler.js'
 * @import { scheduler as SchedulerTypeDefinition } from '~/src/plugins/scheduler.js'
 */
