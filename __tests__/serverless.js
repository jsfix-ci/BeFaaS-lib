/* eslint-env jest */
const serverless = require('../serverless')
const request = require('supertest')

test('serverless.event', async () => {
  const { googleHandler } = serverless.event(async event => ({ ok: true, event }))
  const response = await request(googleHandler)
    .post('/call')
    .send({ test: 'event' })
  expect(response.status).toBe(200)
  expect(response.body).toMatchSnapshot()
})
