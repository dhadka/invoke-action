import * as core from '@actions/core'
import { invokeAction } from './common'

invokeAction('pre').catch(x => {
  core.setFailed(x)
})
