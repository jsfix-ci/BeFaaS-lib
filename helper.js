const path = require('path')

const helper = {
  isLambda: !!process.env.AWS_LAMBDA_FUNCTION_NAME,
  isGoogle: !!process.env.K_SERVICE && !!process.env.K_REVISION,
  isAzure: !!process.env.IS_AZURE_FUNCTION_APP
}

let experiment = {}

try {
  experiment = require(path.join(process.cwd(), 'experiment.json'))
} catch (e) {}

module.exports = {
  prefix: () => {
    if (helper.isLambda) return '/:fn'
    if (helper.isAzure) return '/api/:fn'
    return null
  },
  experiment,
  ...helper
}
