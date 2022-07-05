const _ = require('lodash')
const serverless = require('serverless-http')
const azure = require('azure-function-express')

const Koa = require('koa')
const Router = require('@koa/router')
const bodyParser = require('koa-bodyparser')
const qs = require('qs')

const log = require('./log')
const helper = require('./helper')
const performance = require('./performance')
const call = require('./call')
const db = require('./db')

function createContext (contextId, xPair, dbBindToMeasure) {
  const measurement = m => {
    performance.mark(`${log.fnName}:${contextId}:${xPair}:start:${m}`)
    return () => {
      performance.mark(`${log.fnName}:${contextId}:${xPair}:end:${m}`)
      performance.measure(
        `${log.fnName}:${contextId}:${xPair}:measure:${m}`,
        `${log.fnName}:${contextId}:${xPair}:start:${m}`,
        `${log.fnName}:${contextId}:${xPair}:end:${m}`
      )
    }
  }
  return {
    log: e => log(Object.assign({ contextId }, e || {})),
    call: async (f, payload) => {
      const xPair = `${contextId}-${helper.generateRandomID()}`
      const end = measurement(`rpcOut:${f}:${xPair}`)
      const res = await call(f, contextId, xPair, payload)
      end()
      return res
    },
    mark: m => performance.mark(`${log.fnName}:${contextId}:${m}`),
    measure: measurement,
    db: dbBindToMeasure(measurement),
    contextId,
    xPair
  }
}

function logRequestAndAttachContext (ctx, dbBindToMeasure) {
  const contextId = ctx.request.get('x-context') || helper.generateRandomID()
  const xPair = ctx.request.get('x-pair') || 'undefined-x-pair'
  log({
    contextId,
    xPair,
    request: _.pick(ctx, ['method', 'originalUrl', 'headers'])
  })
  ctx.contextId = contextId
  ctx.xPair = xPair
  ctx.lib = createContext(contextId, xPair, dbBindToMeasure)
}

async function handleErrors (ctx, next) {
  try {
    await next()
  } catch (e) {
    console.log(e.toString())
    ctx.body = { error: e.toString() }
    ctx.status = 502
  }
}

function hybridBodyParser () {
  console.log('in body parser')
  const bp = bodyParser()
  return async (ctx, next) => {
    if (
      helper.isAzure &&
      ctx.request.is('application/x-www-form-urlencoded') &&
      ctx.req.body
    ) {
      console.log('will set req.body')
      ctx.req.body = qs.parse(ctx.req.body, { allowDots: true })
    }

    ctx.request.body =
      helper.isGoogle ||
      helper.isAzure ||
      helper.isTinyfaas ||
      helper.isOpenfaas
        ? ctx.req.body
        : ctx.request.body

    console.log('ctx.request.body is ' + JSON.stringify(ctx.request.body))
    return bp(ctx, next)
  }
}

function serverlessRouter (options, routerFn) {
  console.log('router: ' + JSON.stringify(routerFn))
  console.log('options: ' + JSON.stringify(options))
  if (_.isFunction(options) && _.isUndefined(routerFn)) {
    routerFn = options
    options = {}
  }

  const app = new Koa()
  const router = new Router({
    prefix: helper.prefix()
  })
  console.log('app and router initialized.')

  let dbBindToMeasure = () => undefined
  if (options.db) dbBindToMeasure = db.connect(options.db)

  console.log('will use hybrifBodyParser.')
  router.use(handleErrors, hybridBodyParser())
  console.log('done.')

  const wrapHandler = (m, r, h) =>
    router[m](r, async (ctx, next) => {
      logRequestAndAttachContext(ctx, dbBindToMeasure)
      const end = ctx.lib.measure(`${m}:${r}`)
      console.log('will call handler with:')
      console.log('r: ' + JSON.stringify(r))
      console.log('m: ' + JSON.stringify(m))
      console.log('h: ' + JSON.stringify(h))
      await h(ctx, next)
      end()
    })

  routerFn({
    get: (r, h) => wrapHandler('get', r, h),
    post: (r, h) => wrapHandler('post', r, h),
    put: (r, h) => wrapHandler('put', r, h),
    patch: (r, h) => wrapHandler('patch', r, h),
    del: (r, h) => wrapHandler('del', r, h),
    all: (r, h) => wrapHandler('all', r, h),
    addRpcHandler: handler =>
      router.post('/call', async (ctx, next) => {
        logRequestAndAttachContext(ctx, dbBindToMeasure)
        const end = ctx.lib.measure('rpcIn')
        ctx.body = await handler(ctx.request.body, ctx.lib)
        end()
      })
  })

  console.log('will use routes and methods.')
  app.use(router.routes())
  app.use(router.allowedMethods())

  return {
    tinyfaasHandler: app.callback(),
    openfaasHandler: app.callback(),
    openwhiskHandler: app.callback(),
    lambdaHandler: serverless(app),
    googleHandler: app.callback(),
    azureHandler: azure.createHandler(app.callback())
  }
}

module.exports.router = serverlessRouter
module.exports.rpcHandler = (options, handler) => {
  if (_.isUndefined(handler))
    return serverlessRouter(r => r.addRpcHandler(options))
  return serverlessRouter(options, r => r.addRpcHandler(handler))
}

module.exports.msgHandler = (options, handler) => {
  if (_.isFunction(options) && _.isUndefined(handler)) {
    handler = options
    options = {}
  }

  let dbBindToMeasure = () => undefined
  if (options.db) dbBindToMeasure = db.connect(options.db)

  return {
    lambdaHandler: async (event, ctx) => {
      console.log('ctxEntry: ' + JSON.stringify(ctx))
      console.log('eventEntry: ' + JSON.stringify(event))
      const contextId =
        event.Records[0].Sns.MessageAttributes.contextId.Value ||
        helper.generateRandomID()
      const xPair =
        event.Records[0].Sns.MessageAttributes.xPair.Value || 'undefined-x-pair'

      ctx.contextId = contextId
      ctx.xPair = xPair
      ctx.lib = createContext(contextId, xPair, dbBindToMeasure)

      const end = ctx.lib.measure(`msg`)
      await handler(JSON.parse(event.Records[0].Sns.Message), ctx.lib)
      end()
    },
    googleHandler: async (event, ctx) => {
      console.log('ctxEntry: ' + JSON.stringify(ctx))
      console.log('eventEntry: ' + JSON.stringify(event))
      const msg = event.data
        ? Buffer.from(event.data, 'base64').toString()
        : 'no data'
      console.log('Message: ' + msg)
      const contextId = event.attributes.contextId || helper.generateRandomID()
      const xPair = event.attributes.xPair || 'undefined-x-pair'

      ctx.contextId = contextId
      ctx.xPair = xPair
      ctx.lib = createContext(contextId, xPair, dbBindToMeasure)

      const end = ctx.lib.measure(`msg`)
      await handler(JSON.parse(msg), ctx.lib)
      end()
    },
    azureHandler: async (ctx, event) => {
      console.log('ctxEntry: ' + JSON.stringify(ctx))
      console.log('eventEntry: ' + JSON.stringify(event))
      const contextId = event.data.contextId || helper.generateRandomID()
      const xPair = event.data.xPair || 'undefined-x-pair'

      ctx.contextId = contextId
      ctx.xPair = xPair
      ctx.lib = createContext(contextId, xPair, dbBindToMeasure)

      const end = ctx.lib.measure(`msg`)
      await handler(JSON.parse(event.data.event), ctx.lib)
      end()
    },
    tinyfaasHandler: _.isUndefined(handler)
      ? serverlessRouter(r => r.addRpcHandler(options)).tinyfaasHandler
      : serverlessRouter(options, r => r.addRpcHandler(handler)).tinyfaasHandler
  }
}
