const elasticsearch = require('@elastic/elasticsearch')
const createAwsElasticsearchConnector = require('aws-elasticsearch-connector')
const AWS = require('aws-sdk')

const credentials = require('./aws-credentials')

const REGION_REGEX = /\.(\w{2}-\w{4}-\d)\.es\./

function createClient (url) {
  const local = url.includes('localhost')
  const region = local ? undefined : url.match(REGION_REGEX).pop()
  const awsConfig = local ? undefined : new AWS.Config({ region, credentials })

  const client = new elasticsearch.Client({
    ...createAwsElasticsearchConnector(awsConfig),
    node: url
  })

  // expose the AWS host details
  client.host = { url, region }

  return client
}

module.exports = function (cluster) {
  if (global.workspace.clusters[cluster]) {
    return createClient(global.workspace.clusters[cluster])
  } else {
    console.error(`No cluster named "${cluster}" configured`)
    process.exit(1)
  }
}
