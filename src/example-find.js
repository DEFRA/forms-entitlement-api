import { db } from '~/src/mongo.js'

/**
 *
 */
function findAllExampleData() {
  const cursor = db
    .collection('example-data')
    .find({}, { projection: { _id: 0 } })

  return cursor.toArray()
}

/**
 * @param {string} id
 */
function findExampleData(id) {
  return db
    .collection('example-data')
    .findOne({ exampleId: id }, { projection: { _id: 0 } })
}

export { findAllExampleData, findExampleData }
