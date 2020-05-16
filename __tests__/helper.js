/* eslint-env jest */
const helper = require('../helper')

test('isLambda', () => {
  expect(helper.isLambda).toBe(false)
})

test('iGoogle', () => {
  expect(helper.isGoogle).toBe(false)
})
