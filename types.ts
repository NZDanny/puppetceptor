import { Request, RespondOptions } from 'puppeteer'

export type InterceptorResponses = {
  [property: string]: RespondOptions
}

export type FindInterceptorResponse = (
  url: string
) => Promise<RespondOptions> | null

export type InjectRequestInterceptor = (
  forUrl: string,
  returnValue: RespondOptions
) => void

export type RequestInterceptionHandler = (request: Request) => void

export type InterceptorUtils = {
  injectRequestInterceptor: InjectRequestInterceptor
  getInterceptedRequests: () => Request[]
  expectUrlCalled: (url: string) => Promise<void>
  getLastRequestBody: () => string
  resetInterceptors: () => void
}
