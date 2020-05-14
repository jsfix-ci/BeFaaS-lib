const _ = require('lodash')
const fetch = require('node-fetch')

const endpoints = {}
try {
  const TFOUTPUT = {} // TODO
  endpoints.aws = _.get(TFOUTPUT, 'aws_invoke_url.value')
  endpoints.google = _.get(TFOUTPUT, 'google_invoke_url.value')
} catch (e) {
  console.log(e)
}

module.exports = async (provider, fn, payload) => {
  if (!endpoints[provider]) throw new Error('unknown provider')
  const res = await fetch(`${endpoints[provider]}/${fn}/call`, {
    method: 'post',
    body: JSON.stringify(payload || {}),
    headers: { 'Content-Type': 'application/json' }
  })
  return res.json()
}
