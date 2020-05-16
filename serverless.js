const _ = require('lodash')
const serverless = require('serverless-http')

const Koa = require('koa')
const Router = require('@koa/router')
const bodyParser = require('koa-bodyparser')

const log = require('./log')

function logger (ctx, next) {
  log(Object.assign({}, _.pick(ctx, ['method', 'originalUrl', 'headers'])))
  return next()
}

async function handleErrors (ctx, next) {
  try {
    await next()
  } catch (e) {
    ctx.body = { error: e.toString() }
    ctx.status = 502
  }
}

function hybridBodyParser () {
  const bp = bodyParser()
  return async (ctx, next) => {
    ctx.request.body = ctx.request.body || ctx.req.body
    return bp(ctx, next)
  }
}

function serverlessRouter (routerFn) {
  const app = new Koa()
  const router = new Router({
    prefix: process.env.AWS_LAMBDA_FUNCTION_NAME && '/:fn'
  })

  router.use(logger, handleErrors, hybridBodyParser())
  router.attachEventHandler = eventFn => router.post('/call', async (ctx, next) => {
    ctx.body = await eventFn(ctx.request.body)
  })

  routerFn(router)

  app.use(router.routes())
  app.use(router.allowedMethods())

  return {
    lambdaHandler: serverless(app),
    googleHandler: app.callback()
  }
}

module.exports.router = serverlessRouter
module.exports.event = eventFn => serverlessRouter(r => r.attachEventHandler(eventFn))
