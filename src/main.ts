import * as crypto from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as yaml from 'yaml'
import * as core from '@actions/core'
import * as exec from '@actions/exec'

async function run(): Promise<void> {
  const action = core.getInput('action')
  const token = core.getInput('token')
  const args = core.getInput('args')
  const sandbox = core.getInput('sandbox')
  const sudo = core.getInput('sudo') === 'true'

  const execArgs = []
  const localPath = crypto.randomBytes(20).toString('hex')

  if (token) {
    core.setSecret(token)
  }

  let repo = action
  let ref = undefined

  if (action.indexOf('@') >= 0) {
    const actionParts = action.split('@')

    repo = actionParts[0]
    ref = actionParts.splice(1).join('@')
  }

  try {
    const repoUrl = token ? `https://${token}@github.com/${repo}` : `https://github.com/${repo}`
    await exec.exec('git', ['clone', repoUrl, localPath])

    if (ref) {
      await exec.exec('git', ['checkout', ref])
    }

    if (sudo) {
      if (os.platform() === 'win32') {
        core.info("Sudo not available on Windows.")
      } else {
        execArgs.push('sudo')
      }
    }

    if (sandbox) {
      if (os.platform() !== 'linux') {
        core.error('Sandbox is only supported on Linux')
        return
      }

      await exec.exec('sudo', ['apt-get', 'install', 'firejail']) // TODO: Move to pre step and only run once

      execArgs.push('firejail')

      const sandboxYml = yaml.parse(sandbox)

      if (sandboxYml.network) {
        execArgs.push(`--net=${sandboxYml.network}`)
      }

      // TODO: sandbox file system
    }

    const actionDefinitionPath = path.join(localPath, "action.yml")
    const actionDefinition = yaml.parse(fs.readFileSync(actionDefinitionPath, { encoding: "utf-8" }))

    const executable = actionDefinition.runs.using === 'node12' ? 'node' : actionDefinition.runs.using
    const mainFile = actionDefinition.runs.main

    execArgs.push(executable)
    execArgs.push(path.join(localPath, mainFile))

    if (args) {
      const argsYml = yaml.parse(args)

      for (const key of argsYml) {
        const keyStr = `${key}`
        core.info(`Passing argument ${keyStr}=${argsYml[keyStr]}`)
        process.env[`INPUT_${keyStr.replace(/ /g, '_').toUpperCase()}`] = argsYml[keyStr]
      }
    }

    await exec.exec(execArgs[0], execArgs.slice(1))

    // TODO: Add support for pre and post steps
    // TODO: Add support for containers and composite actions?
  } finally {
    fs.rmdirSync(localPath, { recursive: true })
  }
}

run().catch(x => {
  core.error(x)
  throw x
})
