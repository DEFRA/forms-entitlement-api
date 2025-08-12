const mockErrorFn = jest.fn()
const mockWarnFn = jest.fn()

jest.mock('~/src/helpers/logging/logger.js', () => ({
  createLogger: jest.fn().mockReturnValue({
    error: mockErrorFn,
    warn: mockWarnFn
  })
}))

const mockGetErrorMessage = jest.fn()
jest.mock('~/src/helpers/error-message.js', () => ({
  getErrorMessage: mockGetErrorMessage
}))

const mockInsertOne = jest.fn()
const mockDeleteOne = jest.fn()
const mockFindOne = jest.fn()

jest.mock('~/src/mongo.js', () => {
  return {
    get db() {
      return {
        collection: jest.fn().mockReturnValue({
          insertOne: mockInsertOne,
          deleteOne: mockDeleteOne,
          findOne: mockFindOne
        })
      }
    },
    SYNC_LOCKS_COLLECTION_NAME: 'sync_locks'
  }
})

describe('lock-repository', () => {
  /** @type {LockRepositoryModule} */
  let lockRepository

  beforeEach(async () => {
    jest.resetModules()
    jest.clearAllMocks()
    mockGetErrorMessage.mockImplementation(
      (err) => err.message ?? 'Unknown error'
    )

    lockRepository = await import('~/src/repositories/lock-repository.js')
  })

  describe('acquireLock', () => {
    test('should successfully acquire a lock', async () => {
      mockInsertOne.mockResolvedValue({ acknowledged: true })

      const result = await lockRepository.acquireLock(
        'test-lock',
        'lock-123',
        30
      )

      expect(result).toBe(true)
      expect(mockInsertOne).toHaveBeenCalledWith({
        lockName: 'test-lock',
        lockId: 'lock-123',
        createdAt: expect.any(Date),
        expiresAt: expect.any(Date)
      })

      // Verify expiration time is approximately 30 minutes in the future
      const callArg = mockInsertOne.mock.calls[0][0]
      const timeDiff = callArg.expiresAt.getTime() - callArg.createdAt.getTime()
      expect(timeDiff).toBeCloseTo(30 * 60 * 1000, -3)
    })

    test('should return false when lock already exists (duplicate key error)', async () => {
      const duplicateError = new Error('Duplicate key error')
      const errorWithCode = /** @type {any} */ (duplicateError)
      errorWithCode.code = 11000
      mockInsertOne.mockRejectedValue(duplicateError)

      const result = await lockRepository.acquireLock(
        'test-lock',
        'lock-123',
        30
      )

      expect(result).toBe(false)
      expect(mockErrorFn).not.toHaveBeenCalled()
    })

    test('should throw error for non-duplicate key errors', async () => {
      const otherError = new Error('Database connection failed')
      mockInsertOne.mockRejectedValue(otherError)

      await expect(
        lockRepository.acquireLock('test-lock', 'lock-123', 30)
      ).rejects.toThrow(otherError)

      expect(mockErrorFn).toHaveBeenCalledWith(
        "[LockRepository] Failed to acquire lock 'test-lock': Database connection failed"
      )
    })

    test('should handle custom timeout in minutes', async () => {
      mockInsertOne.mockResolvedValue({ acknowledged: true })

      await lockRepository.acquireLock('test-lock', 'lock-123', 60)

      const callArg = mockInsertOne.mock.calls[0][0]
      const timeDiff = callArg.expiresAt.getTime() - callArg.createdAt.getTime()
      expect(timeDiff).toBeCloseTo(60 * 60 * 1000, -3)
    })
  })

  describe('releaseLock', () => {
    test('should successfully release a lock', async () => {
      mockDeleteOne.mockResolvedValue({ deletedCount: 1 })

      const result = await lockRepository.releaseLock('test-lock', 'lock-123')

      expect(result).toBe(true)
      expect(mockDeleteOne).toHaveBeenCalledWith({
        lockName: 'test-lock',
        lockId: 'lock-123'
      })
    })

    test('should return false when lock not found', async () => {
      mockDeleteOne.mockResolvedValue({ deletedCount: 0 })

      const result = await lockRepository.releaseLock('test-lock', 'lock-123')

      expect(result).toBe(false)
      expect(mockWarnFn).not.toHaveBeenCalled()
    })

    test('should handle errors and return false', async () => {
      const error = new Error('Delete operation failed')
      mockDeleteOne.mockRejectedValue(error)

      const result = await lockRepository.releaseLock('test-lock', 'lock-123')

      expect(result).toBe(false)
      expect(mockWarnFn).toHaveBeenCalledWith(
        "[LockRepository] Failed to release lock 'test-lock': Delete operation failed"
      )
    })
  })

  describe('withLock', () => {
    test('should execute function when lock is acquired', async () => {
      mockInsertOne.mockResolvedValue({ acknowledged: true })
      mockDeleteOne.mockResolvedValue({ deletedCount: 1 })

      const mockFn = jest.fn().mockResolvedValue('success')

      const result = await lockRepository.withLock(
        'test-lock',
        'lock-123',
        mockFn,
        30
      )

      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalled()
      expect(mockInsertOne).toHaveBeenCalled()
      expect(mockDeleteOne).toHaveBeenCalled()
    })

    test('should return null when lock cannot be acquired', async () => {
      const duplicateError = new Error('Duplicate key error')
      const errorWithCode = /** @type {any} */ (duplicateError)
      errorWithCode.code = 11000
      mockInsertOne.mockRejectedValue(duplicateError)

      const mockFn = jest.fn()

      const result = await lockRepository.withLock(
        'test-lock',
        'lock-123',
        mockFn,
        30
      )

      expect(result).toBeNull()
      expect(mockFn).not.toHaveBeenCalled()
      expect(mockDeleteOne).not.toHaveBeenCalled()
    })

    test('should release lock even if function throws error', async () => {
      mockInsertOne.mockResolvedValue({ acknowledged: true })
      mockDeleteOne.mockResolvedValue({ deletedCount: 1 })

      const error = new Error('Function execution failed')
      const mockFn = jest.fn().mockRejectedValue(error)

      await expect(
        lockRepository.withLock('test-lock', 'lock-123', mockFn, 30)
      ).rejects.toThrow(error)

      expect(mockFn).toHaveBeenCalled()
      expect(mockDeleteOne).toHaveBeenCalledWith({
        lockName: 'test-lock',
        lockId: 'lock-123'
      })
    })

    test('should handle release lock failure after function execution', async () => {
      mockInsertOne.mockResolvedValue({ acknowledged: true })
      mockDeleteOne.mockRejectedValue(new Error('Release failed'))

      const mockFn = jest.fn().mockResolvedValue('success')

      const result = await lockRepository.withLock(
        'test-lock',
        'lock-123',
        mockFn,
        30
      )

      expect(result).toBe('success')
      expect(mockWarnFn).toHaveBeenCalledWith(
        "[LockRepository] Failed to release lock 'test-lock': Release failed"
      )
    })
  })

  describe('getLockInfo', () => {
    test('should return lock info when lock exists and is not expired', async () => {
      const createdAt = new Date()
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

      mockFindOne.mockResolvedValue({
        lockName: 'test-lock',
        lockId: 'lock-123',
        createdAt,
        expiresAt
      })

      const result = await lockRepository.getLockInfo('test-lock')

      expect(result).toEqual({
        lockName: 'test-lock',
        lockId: 'lock-123',
        createdAt,
        expiresAt,
        isExpired: false
      })
      expect(mockFindOne).toHaveBeenCalledWith({ lockName: 'test-lock' })
    })

    test('should return lock info with expired status when lock is expired', async () => {
      const createdAt = new Date(Date.now() - 60 * 60 * 1000)
      const expiresAt = new Date(Date.now() - 30 * 60 * 1000)

      mockFindOne.mockResolvedValue({
        lockName: 'test-lock',
        lockId: 'lock-123',
        createdAt,
        expiresAt
      })

      const result = await lockRepository.getLockInfo('test-lock')

      expect(result).toEqual({
        lockName: 'test-lock',
        lockId: 'lock-123',
        createdAt,
        expiresAt,
        isExpired: true
      })
    })

    test('should return null when lock does not exist', async () => {
      mockFindOne.mockResolvedValue(null)

      const result = await lockRepository.getLockInfo('test-lock')

      expect(result).toBeNull()
      expect(mockErrorFn).not.toHaveBeenCalled()
    })

    test('should handle errors and return null', async () => {
      const error = new Error('Database query failed')
      mockFindOne.mockRejectedValue(error)

      const result = await lockRepository.getLockInfo('test-lock')

      expect(result).toBeNull()
      expect(mockErrorFn).toHaveBeenCalledWith(
        "[LockRepository] Failed to get lock info for 'test-lock': Database query failed"
      )
    })
  })

  describe('edge cases', () => {
    test('should handle error objects without code property in acquireLock', async () => {
      const errorWithoutCode = new Error('Some error')
      mockInsertOne.mockRejectedValue(errorWithoutCode)

      await expect(
        lockRepository.acquireLock('test-lock', 'lock-123', 30)
      ).rejects.toThrow(errorWithoutCode)

      expect(mockErrorFn).toHaveBeenCalled()
    })

    test('should use default timeout when not specified', async () => {
      mockInsertOne.mockResolvedValue({ acknowledged: true })

      await lockRepository.acquireLock('test-lock', 'lock-123')

      const callArg = mockInsertOne.mock.calls[0][0]
      const timeDiff = callArg.expiresAt.getTime() - callArg.createdAt.getTime()
      expect(timeDiff).toBeCloseTo(30 * 60 * 1000, -3)
    })

    test('should use default timeout in withLock when not specified', async () => {
      mockInsertOne.mockResolvedValue({ acknowledged: true })
      mockDeleteOne.mockResolvedValue({ deletedCount: 1 })

      const mockFn = jest.fn().mockResolvedValue('success')

      await lockRepository.withLock('test-lock', 'lock-123', mockFn)

      const callArg = mockInsertOne.mock.calls[0][0]
      const timeDiff = callArg.expiresAt.getTime() - callArg.createdAt.getTime()
      expect(timeDiff).toBeCloseTo(30 * 60 * 1000, -3)
    })
  })
})

/**
 * @typedef {typeof LockRepositoryModuleDefinitionStar} LockRepositoryModule
 */

/**
 * @import * as LockRepositoryModuleDefinitionStar from '~/src/repositories/lock-repository.js'
 */
