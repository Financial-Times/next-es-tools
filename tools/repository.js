const elastic = require('../lib/elastic')

let client

function createRepository ({ name, bucketName, bucketRole, bucketFolder }) {
  return client.snapshot.createRepository({
    repository: name,
    verify: true,
    body: {
      type: 's3',
      settings: {
        bucket: bucketName,
        endpoint: 's3.amazonaws.com',
        role_arn: bucketRole,
        base_path: bucketFolder
      }
    }
  })
}

function run (cluster, command) {
  const opts = command.opts()

  client = elastic(cluster)

  if (!opts.bucketName) {
    opts.bucketName = `next-elasticsearch-v7-${client.host.region}-backups`
  }

  return createRepository(opts)
    .then(() => {
      console.log(`Repository "${opts.name}" created (using the bucket "${opts.bucketName}") for ${cluster} cluster`)
      process.exit()
    })
    .catch((err) => {
      console.error(`Repository failed: ${err.toString()}`)
      process.exit(1)
    })
}

module.exports = function (program) {
  program
    .command('repository <cluster>')
    .description('Sets up a snapshot repository')
    .option('-N, --name <name>', 'The repository name', 's3-snapshots')
    .option('-B, --bucket-name <name>', 'The S3 bucket name', '')
    .option('-A, --bucket-role <arn>', 'The S3 bucket ARN role', 'arn:aws:iam::027104099916:role/FTApplicationRoleFor_nextcontent')
    .option('-F, --bucket-folder <name>', 'The S3 bucket subfolder', new Date().toISOString().split('T').shift())
    .action(run)
}
