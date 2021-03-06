import * as crypto from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as yaml from 'yaml'
import * as core from '@actions/core'
import * as exec from '@actions/exec'

export async function setupAction(): Promise<string> {
  const action = core.getInput('action')
  const token = core.getInput('token')
  let localPath = core.getState(`invoke-action-${action}`)

  // Checkout only if necessary
  if (!localPath) {
    core.startGroup('Setup Action')

    // Separate the repo from the tag/ref
    let repo = action
    let ref = undefined

    if (action.indexOf('@') >= 0) {
      const actionParts = action.split('@')

      repo = actionParts[0]
      ref = actionParts.splice(1).join('@')
    }

    // Hide token from output
    if (token) {
      core.setSecret(token)
    }

    // Checkout repo to a random directory
    localPath = crypto.randomBytes(20).toString('hex')

    const repoUrl = token ? `https://${token}@github.com/${repo}` : `https://github.com/${repo}`
    await exec.exec('git', ['clone', repoUrl, localPath])

    if (ref) {
      await exec.exec('git', ['checkout', ref], { cwd: localPath })
    }

    core.saveState(`invoke-action-${action}`, localPath)
    core.endGroup()
  }

  return localPath
}

export async function cleanupAction(): Promise<void> {
  const action = core.getInput('action')
  const localPath = core.getState(`invoke-action-${action}`)

  if (localPath) {
    fs.rmdirSync(localPath, { recursive: true })
  }
}

export async function invokeAction(step: 'pre' | 'main' | 'post'): Promise<void> {
  const args = core.getInput('args')
  const sudo = core.getInput('sudo') === 'true'
  const network = core.getInput('network')
  const fileSystem = core.getInput('filesystem')

  const execArgs = []
  const localPath = await setupAction()

  if (sudo) {
    if (os.platform() === 'win32') {
      core.info("Sudo not available on Windows.")
    } else {
      execArgs.push('sudo')
      execArgs.push('-E') // preserve environment variables
    }
  }

  if (network || fileSystem) {
    if (os.platform() !== 'linux') {
      throw Error('Sandboxing is only supported on Linux')
    }

    core.startGroup('Setup Sandbox')
    await exec.exec('sudo', ['apt-get', 'install', 'firejail']) // TODO: Move to pre step and only run once
    core.endGroup()

    execArgs.push('firejail')
    execArgs.push('--quiet')

    if (network) {
      if (network === 'none') {
        execArgs.push(`--net=none`)
      } else {
        throw Error(`Unrecognized network sandbox option: ${network}`)
      }
    }

    if (fileSystem) {
      if (fileSystem === 'none') {
        // We must allow access to the local path to run the action
        execArgs.push(`--whitelist=${path.resolve(localPath)}`)
      } else if (fileSystem === 'overlay') {
        execArgs.push('--overlay-tmpfs')
      } else if (fileSystem === 'read-only') {
        execArgs.push('--read-only=*')
      } else {
        throw Error(`Unrecognized file system sandbox option: ${fileSystem}`)
      }
    }
  }

  const actionDefinitionPath = path.join(localPath, "action.yml")
  const actionDefinition = yaml.parse(fs.readFileSync(actionDefinitionPath, { encoding: "utf-8" }))

  if (actionDefinition.runs.using === 'docker' || actionDefinition.runs.using === 'composite') {
    throw Error('Docker and composite actions are not supported')
  }

  if (actionDefinition.runs[step]) {
    if (actionDefinition.runs[`${step}-if`] && actionDefinition.runs[`${step}-if`] !== 'success()') {
      throw Error(`Only ${step}-if conditions using success() are supported`)
    }

    const executable = actionDefinition.runs.using === 'node12' ? 'node' : `${actionDefinition.runs.using}`
    const file = `${actionDefinition.runs[step]}`

    execArgs.push(executable)
    execArgs.push(path.join(localPath, file))
  
    if (args) {
      const argsYml = yaml.parse(args)
  
      for (const key of Object.keys(argsYml)) {
        process.env[`INPUT_${key.replace(/ /g, '_').toUpperCase()}`] = argsYml[key]
      }
    }
  
    await exec.exec(execArgs[0], execArgs.slice(1))
  } else {
    core.info(`No ${step}-step defined for this action, skipping`)
  }
}
