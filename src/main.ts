import * as core from '@actions/core'
import { invokeAction } from './common'

invokeAction('main').catch(x => {
  core.setFailed(x)
})
