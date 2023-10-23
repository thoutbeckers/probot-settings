const mergeArrayByName = require('./lib/mergeArrayByName')

/**
 * @param {import('probot').Probot} robot
 */
module.exports = (robot, _, Settings = require('./lib/settings')) => {
  async function syncSettings (context, repo = context.repo()) {
    const config = await context.config('settings.yml', {}, { arrayMerge: mergeArrayByName })
    return Settings.sync(context.octokit, repo, config)
  }

  robot.onAny(async context => {
    console.log("event: "+context.payload.event_id)
    console.log("payload: "+context.payload)
  })

  robot.on('push', async context => {
    const { payload } = context
    const { repository } = payload

    const defaultBranch = payload.ref === 'refs/heads/' + repository.default_branch
    if (!defaultBranch) {
      console.log.debug('Not working on the default branch, returning...')
      robot.log.debug('Not working on the default branch, returning...')
      return
    }

    const settingsModified = payload.commits.find(commit => {
      // If run from a GitHub action, commits lack these properties, see
      // https://github.blog/changelog/2019-10-16-changes-in-github-actions-push-event-payload/
      // So act like settings have changed if we run from an action
      if ('added' in commit || 'modified' in commit) {
        return commit.added.includes(Settings.FILE_NAME) || commit.modified.includes(Settings.FILE_NAME)
      } else {
        return true
      }
    })

    if (!settingsModified) {
      robot.log.debug(`No changes in '${Settings.FILE_NAME}' detected, returning...`)
      console.log(`No changes in '${Settings.FILE_NAME}' detected, returning...`)
      return
    }

    return syncSettings(context)
  })

  robot.on('repository.edited', async context => {
    const { payload } = context
    const { changes, repository } = payload

    if (!Object.prototype.hasOwnProperty.call(changes, 'default_branch')) {
      robot.log.debug('Repository configuration was edited but the default branch was not affected, returning...')
      console.log('Repository configuration was edited but the default branch was not affected, returning...')
      return
    }

    robot.log.debug(`Default branch changed from '${changes.default_branch.from}' to '${repository.default_branch}'`)
    console.log(`Default branch changed from '${changes.default_branch.from}' to '${repository.default_branch}'`)

    return syncSettings(context)
  })

  robot.on('repository.created', async context => {
    return syncSettings(context)
  })
}
