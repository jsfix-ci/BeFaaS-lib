module.exports = {
  isLambda: !!process.env.AWS_LAMBDA_FUNCTION_NAME,
  isGoogle: !!process.env.GCP_PROJECT
}
