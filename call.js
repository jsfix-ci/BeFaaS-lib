const fetch = require('node-fetch')

const endpoints = {
  aws: process.env.AWS_LAMBDA_ENDPOINT,
  google: process.env.GOOGLE_CLOUDFUNCTION_ENDPOINT
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
