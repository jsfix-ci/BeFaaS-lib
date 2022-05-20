const _ = require('lodash')
const fetch = require('node-fetch')

const helper = require('./helper')

const experiment = helper.loadExperiment()

const endpoints = {
  aws: process.env.AWS_LAMBDA_ENDPOINT,
  google: process.env.GOOGLE_CLOUDFUNCTION_ENDPOINT,
  azure: process.env.AZURE_FUNCTIONS_ENDPOINT,
  tinyfaas: process.env.TINYFAAS_ENDPOINT,
  openfaas: process.env.OPENFAAS_ENDPOINT,
  openwhisk: process.env.OPENWHISK_ENDPOINT
}

const publisherEndpoints = {
  aws: process.env.PUBLISHER_AWS_ENDPOINT,
  google: process.env.PUBLISHER_GOOGLE_ENDPOINT,
  azure: process.env.PUBLISHER_AZURE_ENDPOINT,
  tinyfaas: process.env.PUBLISHER_TINYFAAS_ENDPOINT
}

module.exports = async (fn, contextId, xPair, payload) => {

  if (!_.isObject(payload)) throw new Error('payload is not an object')
  
  var provider = ""
  if (fn === "publisher") {
    var functionName = payload.fun
    provider = _.get(experiment, `program.functions.${functionName}.provider`)
    console.log("Will call publisher, provider is " + provider)
	if (!publisherEndpoints[provider]) throw new Error('unknown publisher provider')
  } else {
    provider = _.get(experiment, `program.functions.${fn}.provider`)
    console.log("Will call " + fn + ", provider is " + provider)
    if (!endpoints[provider]) throw new Error('unknown provider')
  } 
  
  if (fn === "publisher") {
    const res = await fetch(`${publisherEndpoints[provider]}/call`, {
      method: 'post',
      body: JSON.stringify(payload || {}),
      headers: {
        'Content-Type': 'application/json',
        'X-Context': contextId,
        'X-Pair': xPair
      }
    })
    return res.json()
  } else {
	const res = await fetch(`${endpoints[provider]}/${fn}/call`, {
        method: 'post',
        body: JSON.stringify(payload || {}),
        headers: {
          'Content-Type': 'application/json',
          'X-Context': contextId,
          'X-Pair': xPair
        }
    })
	return res.json() 
  }
}
