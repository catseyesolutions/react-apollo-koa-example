// @flow
import createDebug from 'debug'
import jwt from 'jsonwebtoken'
import ms from 'ms'
import R from 'ramda'
import digest from './digest'
import env from './env'
import { getUser } from './store'
import type { User } from '../src/types'

const debugAuth = createDebug('example:auth')

function devHeader(ctx: Object, header: string, def: string): string {
  if (env('NODE_ENV', 'production') === 'production') {
    return def
  }
  return ctx.request.get(header) || def
}

function generateTokens(user: User, ctx: Object): { accessToken: string, refreshToken: string } {
  const accessExp = devHeader(
    ctx,
    'X-ACCESS-TOKEN-EXPIRES-IN',
    env('ACCESS_TOKEN_EXPIRES_IN', '2h')
  )
  const refreshExp = devHeader(
    ctx,
    'X-REFRESH-TOKEN-EXPIRES-IN',
    env('REFRESH_TOKEN_EXPIRES_IN', '60d')
  )
  debugAuth('accessExp', accessExp)
  debugAuth('refreshExp', refreshExp)

  // call `parseInt(numStr)` if `numStr` is a minus number because
  // ms('numStr') returns undefined in that case
  // (minus numbers are required by tests)
  const accessToken = jwt.sign(
    {
      user: R.omit(['password'], user),
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor((Date.now() + (ms(accessExp) || parseInt(accessExp, 10))) / 1000)
    },
    env('AUTH_SECRET')
  )
  const refreshToken = jwt.sign(
    {
      user: R.omit(['password'], user),
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor((Date.now() + (ms(refreshExp) || parseInt(refreshExp, 10))) / 1000)
    },
    env('AUTH_SECRET')
  )
  return { accessToken, refreshToken }
}

export async function jwtUser(ctx: Object, next: () => {}) {
  try {
    const { user } = jwt.verify(
      ctx.request.header.authorization ? ctx.request.header.authorization.split(' ')[1] : '',
      env('AUTH_SECRET')
    )
    ctx.state.user = user
  } catch (error) {
    debugAuth('auth failed', error)
  }
  await next()
}

export async function authenticated(ctx: Object, next: () => {}) {
  try {
    const { user } = jwt.verify(
      ctx.request.header.authorization ? ctx.request.header.authorization.split(' ')[1] : '',
      env('AUTH_SECRET')
    )
    ctx.state.user = user
    await next()
  } catch (error) {
    ctx.throw(401, 'Access denied.')
  }
}

export async function signin(ctx: Object) {
  const { username, password } = ctx.request.body
  if (!username || !password) {
    ctx.throw(401, 'Must provide username and password.')
  }
  const user = getUser(username)
  const storedPassword = user ? user.password : null
  if (digest(password) !== storedPassword) {
    ctx.throw(401, 'Username or password incorrect.')
  }
  ctx.body = generateTokens(user, ctx)
}

export async function signout(ctx: Object) {
  ctx.body = {}
}

export async function tokenRefresh(ctx: Object) {
  const { refreshToken } = ctx.request.body
  try {
    const { user } = jwt.verify(refreshToken, env('AUTH_SECRET'))
    const tokens = generateTokens(user, ctx)
    ctx.body = tokens
    ctx.status = 201
  } catch (error) {
    ctx.throw(401, 'Access denied.')
  }
}
