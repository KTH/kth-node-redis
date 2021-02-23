/**
 * Usage example:
 *   const { nextListHint, nextSnapshotHint } = getHintCallbacks()
 *
 *   describe('Module', () => {
 *     describe(`${nextListHint()} exports function test() which`, () => {
 *       it(`works as expected ${nextSnapshotHint()}`, () => {
 *         ...
 *       })
 *     })
 *   })
 */
function getHintCallbacks() {
  let nextListItemId = 0
  let nextSnapshotId = 0

  /**
   * @returns {string} "(1)", "(2)", "(3)" etc.
   */
  const nextListHint = () => {
    nextListItemId += 1
    return `(${nextListItemId})`
  }

  /**
   * @returns {string} "[-> check snapshot 1]", "[-> check snapshot 2]" etc.
   */
  const nextSnapshotHint = () => {
    nextSnapshotId += 1
    return `[-> check snapshot ${nextSnapshotId}]`
  }

  return {
    nextListHint,
    nextSnapshotHint,
  }
}

module.exports = {
  getHintCallbacks,
}
