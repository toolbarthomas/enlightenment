/**
 * Defines the dynamic endpoint list that will be shared within the instance
 * global.
 */
export type EnlightenmentEndpoint = { [key: string]: string }

/**
 * Optional configuration options to use within the renderImage method.
 */
export type EnlightenmentImageOptions =
  | {
      classname?: string
    }
  | string
/**
 * Defines the Global state typing that is assigned to the Window context.
 */
export type EnlightenmentState = {
  currentElements: Element[]
  mode?: string
  endpoints: EnlightenmentEndpoint
  verbose?: boolean
}

/**
 * Definition of a single throttled handler that will not stack if called
 * multiple times within the defined throttle delay.
 */
export type EnlightenmentThrottle = [Function, ReturnType<typeof setTimeout>]

/**
 * Type reference for the expected process method that assigned within an
 * Enlightenment Component.
 */
export type EnlightenmentProcess = (target?: HTMLElement) => void

/**
 * Contains the active document Event listeners that are created from the
 * constructed Class context.
 */
export type GlobalEventType = Event['type']
export type GlobalEventHandler = Function
export type GlobalEventContext = EventTarget
export type GlobalEvent = [
  GlobalEventType,
  GlobalEventHandler,
  GlobalEventContext,
  GlobalEventHandler
]

/**
 * Optional options to use for Enlightenment.hook method.
 */
export type HookOptions = {
  context?: Element
  data: any
}
