const _ = require('lodash')
const serverless = require('serverless-http')
const azure = require('azure-function-express')

const Koa = require('koa')
const Router = require('@koa/router')
const bodyParser = require('koa-bodyparser')

const log = require('./log')
const helper = require('./helper')

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
    ctx.request.body = helper.isGoogle ? ctx.req.body : ctx.request.body
    return bp(ctx, next)
  }
}

function serverlessRouter (routerFn) {
  const app = new Koa()
  const router = new Router({
    prefix: helper.isLambda && '/:fn'
  })

  router.use(logger, handleErrors, hybridBodyParser())
  router.addRpcHandler = handler => router.post('/call', async (ctx, next) => {
    ctx.body = await handler(ctx.request.body)
  })

  routerFn(router)

  app.use(router.routes())
  app.use(router.allowedMethods())

  return {
    lambdaHandler: serverless(app),
    googleHandler: app.callback(),
    azureHandler: azure.createHandler(app.callback())
  }
}

module.exports.router = serverlessRouter
module.exports.rpcHandler = handler => serverlessRouter(r => r.addRpcHandler(handler))
