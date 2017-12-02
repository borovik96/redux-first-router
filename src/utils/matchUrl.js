// @flow
import pathToRegexp from 'path-to-regexp'
import qs from 'query-string'
import { stripBasename, parsePath } from '../history/utils'

type CompileOptions = {
  partial?: boolean,
  strict?: boolean
}

type MatchOptions = {
  partial?: boolean,
  strict?: boolean,
  path?: string
}

type Compiled = {
  re: RegExp,
  keys: Array<{ name: string }>
}

type Match = {
  path: string,
  url: string,
  isExact: boolean,
  params: Object
}

type Matchers = {
  path: string,
  query?: Object,
  hash?: string
}

type Location = {
  pathname: string,
  search: string,
  hash: string
}

export default (
  l: string | Location,
  matchers: Matchers,
  options?: Object = {}
) => {
  const { pathname, search, hash } = typeof l === 'string' ? parsePath(l) : l

  const { match, keys } = matchPath(pathname, matchers.path, options)
  if (!match) return null

  const query = matchQuery(search, matchers.query)
  if (!query) return null

  if (matchers.hash && !matchVal(hash, matchers.hash)) return null

  const [path, ...values] = match
  const transform = options.transform
  let params

  // Both NavLink and regular route matching via urlToAction use matchUrl.
  // NavLink however matches the current URL against the URL generated by its `to`
  // prop, which is non-dynamic, i.e. it doesn't contain `/:someParam`. That means
  // it doesn't have any dynamic keys/pathSegments to transform. Instead the NavLink
  // component simply attaches the `params` from its corresponding action to the
  // below returned `match` object.
  if (transform) {
    params = keys.reduce((params, key, index) => {
      params[key.name] = transform(values[index], key.name)
      return params
    }, {})
  }

  return {
    params,
    query,
    hash,
    matchedPath: matchers.path === '/' && path === '' ? '/' : path, // the matched portion of the URL
    matchers,
    partial: !!options.partial
  }
}

const matchPath = (path, matcher, options = {}) => {
  const { re, keys } = compilePath(matcher, options)
  const match = re.exec(path)
  return { match, keys }
}

const matchQuery = (search, matcher) => {
  const query = search ? parseSearch(search) : {}

  if (!matcher) return query

  for (const key in matcher) {
    const val = query[key]
    const expected = matcher[key]
    if (!matchVal(val, expected)) return null
  }

  return query
}

const matchVal = (val, expected) => {
  const type = typeof expected

  if (type === 'boolean') {
    return val !== '' && val !== undefined
  }
  else if (type === 'string') {
    return expected === val
  }
  else if (type === 'function') {
    return expected(val)
  }
  else if (expected instanceof RegExp) {
    return expected.test(val)
  }

  return true
}


const parseSearch = (search: string) =>
  queries[search] || (queries[search] = qs.parse(search))

const queries = {}
const patternCache = {}

const cacheLimit = 10000
let cacheCount = 0

const compilePath = (
  pattern: string,
  options: CompileOptions = {}
): Compiled => {
  const { partial = false, strict = false } = options
  const cacheKey = `${partial ? 't' : 'f'}${strict ? 't' : 'f'}`
  const cache = patternCache[cacheKey] || (patternCache[cacheKey] = {})

  if (cache[pattern]) return cache[pattern]

  const keys = []
  const re = pathToRegexp(pattern, keys, { end: !partial, strict })
  const compiledPattern = { re, keys }

  if (cacheCount < cacheLimit) {
    cache[pattern] = compiledPattern
    cacheCount++
  }

  return compiledPattern
}

