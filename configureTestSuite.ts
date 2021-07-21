import { ConsoleMessage } from 'puppeteer'

import configureInterceptors from './configureInterceptors'
import { FindInterceptorResponse, InterceptorUtils } from './types'
import { getServerHost } from './url-builders'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toHaveNoConsoleErrors: (errors: number) => CustomMatcherResult
    }
  }
}

expect.extend({
  toHaveNoConsoleErrors(errors: number): jest.CustomMatcherResult {
    if (errors > 0) {
      return {
        message: (): string => `Found ${errors} errors in the console`,
        pass: false
      }
    }
    return {
      pass: true,
      message: (): string => 'No errors were found in the console'
    }
  }
})

export default async (
  findInterceptorResponse: FindInterceptorResponse = () => null
): Promise<InterceptorUtils> => {
  const testServerHost = getServerHost()

  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 })

  // Set browser language
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'language', {
      get: function () {
        return 'en-US'
      }
    })
  })

  // Set up error listeners, fail test on console error
  let errors: string[] = []

  const consoleListener = (msg: ConsoleMessage) => {
    const type = msg.type()
    const text = msg.text()
    if (type === 'error') {
      errors.push(`[${type}] ${text}`)
      console.error(`[${type}] ${text}`)
    }
    if (type === 'log') {
      console.log(`[browser log] ${text}`)
    }
  }

  page.on('console', consoleListener)

  beforeEach(() => {
    errors = []
  })

  afterEach(() => {
    expect(errors.length).toHaveNoConsoleErrors(0)
  })

  afterAll(() => {
    page.removeListener('console', consoleListener)
  })

  // Set up interception
  if (process.env.E2EMODE !== 'true') {
    await page.setRequestInterception(true)

    const { requestInterceptionHandler, interceptorUtils } =
      configureInterceptors(testServerHost, findInterceptorResponse)

    page.on('request', requestInterceptionHandler)

    return interceptorUtils
  }
  return null
}
