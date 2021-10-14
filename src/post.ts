import * as core from '@actions/core'
import { invokeAction } from './common'

invokeAction('post').catch(x => {
  core.setFailed(x)
})
