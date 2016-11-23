const spawn = require('child_process').spawn
const fetch = require('node-fetch')

function diffutils (a, b) {
  // These files are large (25mb+) and no streaming diff module I could find
  // could calculate the difference correctly.
  //
  // Instead we shell out to the *nix diffutils
  // <http://man7.org/linux/man-pages/man1/diff.1.html>
  return new Promise((resolve, reject) => {
    const data = []
    const proc = spawn('diff', [ a, b ], { cwd: process.cwd() })

    proc.stdout.on('data', (chunk) => {
      data.push(chunk)
    })

    proc.stderr.on('data', (chunk) => {
      data.push(chunk)
    })

    proc.on('error', (err) => {
      reject(new Error(err))
    })

    proc.on('close', (code) => {
      // diffutils will return 1 when differences are found
      if (code === 0 || code === 1) {
        resolve(data.join(''))
      } else {
        reject(new Error(data.join('')))
      }
    })
  })
}

function extractUUIDs (changes) {
  // Example format output by diffutils:
  // 312045a312046
  // > 755b39d8-f27f-11e0-931e-00144feab49a
  // 678170d678170
  // < fffd2144-711d-3d26-a329-8b6c0e51b9de
  const regex = /^[<>]\s+(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})$/

  return changes.split('\n').reduce((uuids, line) => {
    const uuid = line.match(regex)
    return uuid ? uuids.concat(uuid.pop()) : uuids
  }, [])
}

function checkStatus (uuid) {
  return Promise.all([
    fetchCapiV1(uuid),
    fetchCapiV2(uuid)
  ])
    .then(([ resV1, resV2 ]) => {
      const statusV1 = resV1.status
      const statusV2 = resV2.status

      // CAPI V1 may return a 403 because =/
      if (/^4/.test(statusV1) && statusV2 === 404) {
        return `${uuid} should be deleted`
      }

      if (statusV1 === 200 || statusV2 === 200) {
        return `${uuid} should be ingested`
      }

      return `Unsure what to do with ${uuid}`
    })
}

function fetchCapiV1 (uuid) {
  return fetch(`https://api.ft.com/content/items/v1/${uuid}`, {
    headers: { 'X-Api-Key': global.workspace.keys.capi }
  })
}

function fetchCapiV2 (uuid) {
  return fetch(`https://api.ft.com/enrichedcontent/${uuid}`, {
    headers: { 'Authorization': global.workspace.keys.capi }
  })
}

function run ([ file1, file2 ], command) {
  return diffutils(file1, file2)
    .then((changes) => {
      const uuids = extractUUIDs(changes)
      return Promise.all(uuids.map(checkStatus))
    })
    .then((actions) => console.log(actions.join('\n')))
    .catch((err) => console.error(`Diff failed: ${err.message}`))
}

module.exports = function (program) {
  program
    .command('diff <files...>')
    .description('Finds differences between two sets of UUIDs')
    .action(run)
}
