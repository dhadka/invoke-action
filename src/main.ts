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
  const sudo = core.getInput('sudo') === 'true' && os.platform() !== 'win32'

  const localPath = crypto.randomBytes(20).toString('hex')

  if (token) {
    core.setSecret(token)
  }

  try {
    const repoUrl = token ? `https://${token}@github.com/${action}` : `https://github.com/${action}`
    await exec.exec('git', ['clone', repoUrl, localPath])

    // TODO: Checkout specific tag
    
    const actionDefinitionPath = path.join(localPath, "action.yml")
    const actionDefinition = yaml.parse(fs.readFileSync(actionDefinitionPath, { encoding: "utf-8" }))

    const executable = actionDefinition.runs.using === 'node12' ? 'node' : actionDefinition.runs.using
    const mainFile = actionDefinition.runs.main

    if (sandbox) {
      if (os.platform() !== 'linux') {
        core.error('Sandbox is only supported on Linux')
        return
      }

      // TODO: This should be done in a pre step
      await exec.exec('sudo', ['apt-get', 'install', 'firejail'])
    }

    // TODO: Process inputs, outputs, state

    if (sudo) {
      await exec.exec('sudo', [executable, path.join(localPath, mainFile)])
    } else {
      await exec.exec(executable, [path.join(localPath, mainFile)])
    }

    // TODO: Add support for pre and post steps
    // TODO: Add support for containers and composite actions?
  } finally {
    fs.rmdirSync(localPath, { recursive: true })
  }
}

run().catch(x => core.error(x))
