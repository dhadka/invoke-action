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
  const sandbox = core.getInput('sandbox')
  const sudo = core.getInput('sudo') === 'true'

  let execArgs = []

  const localPath = crypto.randomBytes(20).toString('hex')

  if (token) {
    core.setSecret(token)
  }

  try {
    const repoUrl = token ? `https://${token}@github.com/${action}` : `https://github.com/${action}`
    await exec.exec('git', ['clone', repoUrl, localPath])

    // TODO: Checkout specific tag

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

      // TODO: This should be done in a pre step
      await exec.exec('sudo', ['apt-get', 'install', 'firejail'])

      execArgs.push('firejail')

      const sandboxYml = yaml.parse(sandbox)

      if (sandboxYml.network) {
        execArgs.push(`--net=${sandboxYml.network}`)
      }
    }

    const actionDefinitionPath = path.join(localPath, "action.yml")
    const actionDefinition = yaml.parse(fs.readFileSync(actionDefinitionPath, { encoding: "utf-8" }))

    const executable = actionDefinition.runs.using === 'node12' ? 'node' : actionDefinition.runs.using
    const mainFile = actionDefinition.runs.main

    execArgs.push(executable)
    execArgs.push(path.join(localPath, mainFile))

    // TODO: Process inputs, outputs, state

    await exec.exec(execArgs[0], execArgs.slice(1))

    // TODO: Add support for pre and post steps
    // TODO: Add support for containers and composite actions?
  } finally {
    fs.rmdirSync(localPath, { recursive: true })
  }
}

run().catch(x => core.error(x))
