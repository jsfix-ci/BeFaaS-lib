module.exports = {
  isLambda: !!process.env.AWS_LAMBDA_FUNCTION_NAME,
  isGoogle: !!process.env.K_SERVICE && !!process.env.K_REVISION
}
