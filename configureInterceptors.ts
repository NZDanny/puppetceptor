import { Request, RespondOptions } from 'puppeteer'

import {
  FindInterceptorResponse,
  InjectRequestInterceptor,
  RequestInterceptionHandler,
  InterceptorUtils,
  InterceptorResponses
} from './types'
import { clearInterval } from 'timers'

// UTILS
const getLastRequestBody = (interceptedRequests: Request[]): string => {
  const lastRequest = interceptedRequests[interceptedRequests.length - 1]

  const body = lastRequest ? lastRequest.postData() : undefined

  return body ? JSON.parse(body) : undefined
}

const waitForUrlCalled = (
  url: string,
  interceptedRequests: Request[],
  timeoutInMs: number = 3000
) => {
  let timeOut = false
  const timer = setTimeout(() => (timeOut = true), timeoutInMs)
  return new Promise<void>((resolve, reject) => {
    const interval = setInterval(() => {
      if (interceptedRequests.map((request) => request.url()).includes(url)) {
        clearInterval(interval)
        clearTimeout(timer)
        resolve()
      }
      if (timeOut) {
        clearInterval(interval)
        reject(
          `Url ${url} was not called within the timeout of ${timeoutInMs}ms`
        )
      }
    }, 20)
  })
}

// INTERCEPTION HANDLER
const createRequestInterceptionHandler = (
  findInterceptorResponse: FindInterceptorResponse
): {
  requestInterceptionHandler: RequestInterceptionHandler
  injectRequestInterceptor: InjectRequestInterceptor
  removeAllInjectedInterceptors: () => {}
} => {
  let injectedRequestInterceptors: InterceptorResponses = {}

  return {
    requestInterceptionHandler: (interceptedRequest: Request) => {
      const interceptedUrl = interceptedRequest.url()

      if (injectedRequestInterceptors[interceptedUrl]) {
        interceptedRequest.respond(injectedRequestInterceptors[interceptedUrl])
      } else {
        findInterceptorResponse(interceptedRequest.url()).then(
          (interceptorResponse) => {
            if (interceptorResponse) {
              interceptedRequest.respond(interceptorResponse)
            } else {
              console.error(
                `Failed to find interceptor for internal request with URL ${interceptedUrl}. Please provide an interceptor this this request.`
              )
              interceptedRequest.respond({ status: 404 })
            }
          }
        )
      }
    },
    injectRequestInterceptor: (
      url: string,
      responseOptions: RespondOptions
    ) => {
      injectedRequestInterceptors[url] = responseOptions
    },
    removeAllInjectedInterceptors: () => (injectedRequestInterceptors = {})
  }
}

const defaultOnExternalRequest = (interceptedRequest: Request) =>
  interceptedRequest.respond({ status: 204 })

export default (
  testServerHost: string,
  findInterceptorResponse: FindInterceptorResponse,
  onExternalRequest: (request: Request) => void = defaultOnExternalRequest
): {
  requestInterceptionHandler: RequestInterceptionHandler
  interceptorUtils: InterceptorUtils
} => {
  let interceptedRequests: Request[] = []
  const {
    requestInterceptionHandler,
    injectRequestInterceptor,
    removeAllInjectedInterceptors
  } = createRequestInterceptionHandler(findInterceptorResponse)

  return {
    requestInterceptionHandler: (interceptedRequest: Request) => {
      interceptedRequests.push(interceptedRequest)

      const { origin } = new URL(interceptedRequest.url())
      const isInternalRequest = testServerHost.startsWith(origin)

      if (isInternalRequest) {
        requestInterceptionHandler(interceptedRequest)
      } else {
        onExternalRequest(interceptedRequest)
      }
    },
    interceptorUtils: {
      injectRequestInterceptor,
      getInterceptedRequests: () => interceptedRequests,
      expectUrlCalled: (url: string) =>
        waitForUrlCalled(url, interceptedRequests),
      getLastRequestBody: () => getLastRequestBody(interceptedRequests),
      resetInterceptors: () => {
        interceptedRequests = []
        removeAllInjectedInterceptors()
      }
    }
  }
}
