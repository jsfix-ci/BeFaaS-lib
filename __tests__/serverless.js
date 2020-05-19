/* eslint-env jest */
const serverless = require('../serverless')
const request = require('supertest')

test('serverless.event', async () => {
  const { googleHandler } = serverless.rpcHandler(async event => ({
    ok: true,
    event
  }))
  const response = await request(googleHandler)
    .post('/call')
    .send({ test: 'event' })
  expect(response.status).toBe(200)
  expect(response.body).toMatchSnapshot()
})

test('serverless.router', async () => {
  const { googleHandler } = serverless.router(router => {
    router.get('/', (ctx, next) => {
      ctx.body = { ok: true }
    })
    router.addRpcHandler(async event => ({ ok: true, event }))
  })
  const responseGET = await request(googleHandler).get('/')
  expect(responseGET.status).toBe(200)
  expect(responseGET.body).toMatchSnapshot()

  const responsePOST = await request(googleHandler)
    .post('/call')
    .send({ test: 'event2' })
  expect(responsePOST.status).toBe(200)
  expect(responsePOST.body).toMatchSnapshot()
})
