import {
  EnlightenmentDataEntry,
  EnlightenmentJSONResponse,
  EnlightenmentJSONResponseArray,
  EnlightenmentJSONResponseObject,
  EnlightenmentJSONResponseValue,
  EnlightenmentJSONResponseTransformer
} from '../_types/main'

import { EnlightenmentKernel } from './Kernel'

export class EnlightenmentParser extends EnlightenmentKernel {
  /**
   * Parses the defined string value as JSON and return the output within an
   * Array regardless of the result.
   *
   * @param value The string value to parse.
   * @param transform Optional handler to transform the initial values of the
   * parsed JSON. This can be used to mutate the initial Array entry or include
   * additional properties within the initial JSON Object.
   */
  static parseJSON(value: any, transform?: EnlightenmentJSONResponseTransformer) {
    let json: any
    let isValid = false

    if (!value || !value.length) {
      return []
    }

    try {
      const escaped = value.replaceAll(`'`, `"`)
      json = JSON.parse(escaped)
      isValid = true
    } catch (exception) {
      //@TODO use existing Console instead?
      if (exception) {
        return value ? value.split(',').map(parseFloat || String) : []
      }
    }

    if (typeof transform === 'function') {
      const response: EnlightenmentDataEntry[] = []

      try {
        Object.entries(json).forEach(
          ([key, value]: [string, EnlightenmentJSONResponseValue], index) => {
            const payload: EnlightenmentJSONResponseObject = {}
            payload[key] = value

            const body = (typeof value === 'string' ? value : payload) as EnlightenmentDataEntry

            const result = transform(value)

            if (result && result instanceof Object) {
              Object.freeze(result)
            } else if (body instanceof Object) {
              Object.freeze(body)
            }

            response.push(result !== undefined ? result : body)
          }
        )

        isValid = Object.values(response).filter((r) => r !== undefined && r).length ? true : false
      } catch (exception) {
        if (exception) {
          isValid = false

          //@TODO use existing Console instead?
          console.error(exception)
        }
      }

      if (isValid) {
        return (Array.isArray(response) ? response : [response]) as EnlightenmentJSONResponse
      }
    }

    if (Array.isArray(json)) {
      return json as EnlightenmentJSONResponseArray
    }

    if (json instanceof Object) {
      return json as EnlightenmentJSONResponseObject
    }

    return [json] as EnlightenmentJSONResponseObject
  }

  /**
   * Parse the defined Matrix value as array with string or number values.
   *
   * @param value The Matrix value to parse.
   */
  static parseMatrixValue(value: string) {
    if (!value) {
      return []
    }

    const matrix = value
      .split(/\w*(...)[(]/gim)
      .filter((e) => e.includes(')'))
      .map((e) => e.split(')')[0].split(',').map(EnlightenmentParser.strip).map(parseFloat))
      .flat()

    return matrix
  }

  /**
   * Verifies the defined URL and resolve any external url to prevent insecure
   * requests.
   *
   * @param url Resolve the initial url value.
   */
  static resolveURL(url: string) {
    if (typeof url !== 'string') {
      return ''
    }

    let resolved: string = ''

    try {
      const request = new URL(url)
      const location = EnlightenmentKernel.location

      const port = parseInt(location.port || request.port) || 80
      const [protocol, relativeURL] = request.href.split(request.host)

      resolved =
        protocol +
        ([80, 443].includes(port)
          ? EnlightenmentKernel.location.hostname
          : EnlightenmentKernel.location.host) +
        relativeURL
    } catch (_) {}

    return resolved
  }

  /**
   * Sanitize the defined string value to ensure no HTML element is returned
   * or created from the initial value.
   *
   * @param value The value to sanitize.
   */
  static sanitizeHTML(value?: string) {
    const raw = document.createElement('div')
    raw.innerHTML = value || ''

    const html = raw.textContent || ''

    raw.remove()

    return html
  }

  /**
   * Removes any whitespace from the defined string value.
   *
   * @param value The value to strip.
   */
  static strip(value?: string) {
    if (value === undefined) {
      return ''
    }

    return typeof value === 'string'
      ? value
          .split(' ')
          .join('')
          .replace(/\r?\n|\r/g, '')
      : String(value)
  }

  /**
   * Helper function to ensure the requested property is returned from a
   * dynamic string or object value.
   *
   * @param property The existing property name that exists within the
   * constructed instance.
   * @param value Assigns the defined value.
   * @param optional Return an empty value when TRUE the initial property is
   * undefined.
   */
  static usePropertyValue(property: string, value?: any, optional?: boolean) {
    return EnlightenmentParser.sanitizeHTML(
      String((typeof value === 'string' && !optional ? value : (value || {})[property]) || '')
    )
  }
}
