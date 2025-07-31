/* eslint-disable no-console */
import { MongoClient } from 'mongodb'

const MONGO_URI =
  process.env.MONGO_URI ??
  'mongodb://localhost:27018/forms-entitlement-api-test?replicaSet=rs0&directConnection=true'

const testUsers = [
  {
    userId: 'user-email1-mail-com',
    email: 'email1@mail.com',
    displayName: 'Test User 1',
    roles: ['admin'],
    scopes: [
      'form-read',
      'form-edit',
      'form-delete',
      'form-publish',
      'user-read',
      'user-create',
      'user-edit',
      'user-delete'
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    userId: 'user-email2-mail-com',
    email: 'email2@mail.com',
    displayName: 'Test User 2',
    roles: ['form-creator'],
    scopes: ['form-read', 'form-edit'],
    createdAt: new Date(),
    updatedAt: new Date()
  }
]

/**
 * Seeds test data into MongoDB for integration tests
 * @returns {Promise<void>}
 */
async function seedTestData() {
  console.log('[SEED] Connecting to MongoDB...')
  const client = new MongoClient(MONGO_URI)

  try {
    await client.connect()
    console.log('[SEED] Connected to MongoDB')

    const db = client.db()
    const collection = db.collection('user-entitlement')

    await collection.deleteMany({})
    console.log('[SEED] Cleared existing users')

    const result = await collection.insertMany(testUsers)
    console.log(`[SEED] Inserted ${result.insertedCount} test users`)

    const count = await collection.countDocuments()
    console.log(`[SEED] Total users in database: ${count}`)
  } catch (error) {
    console.error('[SEED] Error seeding test data:', error)
    throw error
  } finally {
    await client.close()
    console.log('[SEED] Disconnected from MongoDB')
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedTestData().catch((/** @type {unknown} */ error) => {
    console.error('[SEED] Failed to seed test data:', error)
    throw error
  })
}

export { seedTestData, testUsers }
