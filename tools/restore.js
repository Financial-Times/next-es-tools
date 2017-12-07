const progress = require('../lib/progress')
const elastic = require('../lib/elastic')
const wait = require('../lib/wait')

let client
let status

function verifyRepository ({ repository }) {
  return client.snapshot.verifyRepository({ repository })
}

async function restoreSnapshot ({ repository, snapshot, index }) {
  const response = await client.snapshot.restore({
    repository,
    snapshot,
    waitForCompletion: false,
    body: {
      indices: index,
      // we're restoring an index, not the cluster
      include_aliases: false
    }
  })

  if (!response.accepted) {
    if (!response.snapshot.indices.length) {
      return Promise.reject(`No index named "${index}" found`)
    }

    return Promise.reject('Nothing to restore')
  }
}

async function pingStatus ({ snapshot, index }) {
  const response = await client.indices.recovery({ index })

  if (response.hasOwnProperty(index)) {
    const stats = response[index].shards.filter((item) => (
      item.type === 'SNAPSHOT' && item.source.snapshot === snapshot
    ))

    status.total = stats.reduce((count, item) => (
      count + item.index.files.total
    ), 0)

    status.curr = stats.reduce((count, item) => (
      count + item.index.files.recovered
    ), 0)

    if (status.total > 0 && status.curr <= status.total) {
      status.tick(0)
    }

    if (stats.every(({ stage }) => stage === 'DONE')) {
      return
    } else {
      await wait(10 * 1000)
    }
  } else {
    console.log(`Waiting for restore of "${snapshot}" to start`)
    await wait(3000)
  }

  return pingStatus({ snapshot, index })
}

async function run (cluster, command) {
  const opts = command.opts()

  client = elastic(cluster)
  status = progress('Restoring snapshot')

  try {
    await verifyRepository(opts)
    await restoreSnapshot(opts)
    await pingStatus(opts)

    console.log(`Restored "${opts.snapshot}" snapshot of "${opts.index}" index to ${cluster} cluster`)
    process.exit()
  } catch (err) {
    console.error(`Restore failed: ${err.toString()}`)
    process.exit(1)
  }
}

module.exports = function (program) {
  program
    .command('restore <cluster>')
    .description('Restores an index snapshot')
    .option('-I, --index <name>', 'The index name', 'content')
    .option('-S, --snapshot <name>', 'The snapshot name', 'my-snapshot')
    .option('-R, --repository <name>', 'The repository name', 's3-snapshots')
    .action(run)
}
