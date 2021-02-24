/**
 * @param {*} input
 * @param {{ replaceSpecials?: boolean, replaceFunctions?: boolean }} [options]
 *
 * @returns {*}
 */
function copyObject(input, options) {
  const { replaceSpecials, replaceFunctions } = options || {}

  const _recursion = obj => {
    if (Array.isArray(obj)) {
      return obj.map(_recursion)
    }
    if (obj != null && typeof obj === 'object') {
      const result = {}
      Object.keys(obj).forEach(key => {
        result[key] = _recursion(obj[key])
      })
      return result
    }
    if ((replaceSpecials || replaceFunctions) && typeof obj === 'function') {
      return `(FUNC:${obj.name || 'anonymous'})`
    }
    return obj
  }

  return _recursion(input)
}

module.exports = {
  copyObject,
}
