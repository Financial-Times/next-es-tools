const elastic = require('../lib/elastic')

let client

function fetchAliases () {
  return client.cat.aliases({
    format: 'json'
  })
}

function fetchIndices () {
  return client.cat.indices({
    format: 'json'
  })
}

function extractCurrentIndex (aliases) {
  // check all aliases point at the same index
  const unique = new Set(aliases.map((alias) => alias.index))

  if (unique.size === 1) {
    return unique.values().next().value
  } else {
    throw new Error(`Alias mismatch (${unique.size}), changes must be made manually`)
  }
}

function extractLatestIndex (indices) {
  const PATTERN = /^content_\d{4}-\d{2}-\d{2}$/
  const DATE = /(\d{4}-\d{2}-\d{2})/

  const toDate = (index) => new Date(index.match(DATE).pop())

  return indices
    // pull out index names
    .map((item) => item.index)
    // ignore kibana etc.
    .filter((index) => PATTERN.test(index))
    // sort by date, oldest to newest
    .sort((a, b) => toDate(a) - toDate(b))
    // we have a winner!
    .pop()
}

function updateAliases (aliases, indices) {
  const current = extractCurrentIndex(aliases)
  const latest = extractLatestIndex(indices)

  if (current === latest) {
    throw new Error(`Current index and latest index are the same (${latest})`)
  }

  const actions = aliases.reduce((actions, { alias }) => {
    console.log(`Removing ${current} => ${alias}`)
    actions.push({ remove: { index: current, alias } })

    console.log(`Adding ${latest} => ${alias}`)
    actions.push({ add: { index: latest, alias } })

    return actions
  }, [])

  return client.indices.updateAliases({ body: { actions } })
}

async function run (cluster, command) {
  client = elastic(cluster)

  const [ aliases, indices ] = await Promise.all([
    fetchAliases(),
    fetchIndices()
  ])

  try {
    await updateAliases(aliases, indices)

    console.log('Alias complete')
    process.exit()
  } catch (err) {
    console.error(`Alias failed: ${err.toString()}`)
    process.exit(1)
  }
}

module.exports = function (program) {
  program
    .command('alias <cluster>')
    .description('Automatically updates existing aliases to point to the latest index')
    .action(run)
}
