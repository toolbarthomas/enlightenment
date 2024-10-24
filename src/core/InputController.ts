import {
  EnlightenmentDOMResizeOptions,
  EnlightenmentInputControllerCallbackOptions,
  EnlightenmentInputControllerPointerData,
  EnlightenmentInteractionData,
  EnlightenmentInteractionEndCallback
} from '../_types/main'

import { eventOptions } from './Mixins'

import { EnlightenmentColorHelper } from './ColorHelper'
import { Enlightenment } from '../Enlightenment'

export class EnlightenmentInputController extends EnlightenmentColorHelper {
  /**
   * Assign the required keyboard control codes to a semantic name.
   */
  static keyCodes = {
    // Keyboard action trigger signal
    confirm: [13, 32],
    // Keyboard action exit signal
    exit: [27],
    // Keyboard additional action trigger signal
    meta: [9, 16, 17, 18, 20]
  }

  /**
   * Defines the possible interaction Type values to use from the
   * [data-interaction] Data Attribute that should be assigned from the
   * handleDragStart() target element.
   */
  static interactionTypes = ['move', 'move-x', 'move-y', 'resize', 'resize-x', 'resize-y']

  /**
   * Should contain the updated Resize values for the selected Drag context.
   */
  interactionContext?: HTMLElement
  interactionContextHeight?: number
  interactionContextTranslateX?: number
  interactionContextTranslateY?: number
  interactionContextWidth?: number
  interactionContextX?: number
  interactionContextY?: number
  interactionHost?: HTMLElement
  interactionTarget?: HTMLElement

  /**
   * Should hold the current edge value while isGrabbed equals TRUE.
   */
  currentEdgeX?: number
  currentEdgeY?: number

  /**
   * Reference to the actual Element that is mutated during the interaction.
   */
  currentInteraction: EnlightenmentInteractionData = {}
  currentInteractionCount = 0
  currentInteractionTolerance?: number

  /**
   * Keep track of the interaction trigger that is currently used.
   */
  currentInteractionOrigin?: Element

  /**
   * Optional flag that should be used by the loaded FocusTrap custom Element to
   * hold the current focus within the defined context.
   */
  hasActiveFocusTrap?: boolean = false

  /**
   * Should hold the current integer X & Y values of the defined Pointer.
   */
  initialPointerX?: number
  initialPointerY?: number

  /**
   * Enable the usage for the Aria grabbed Attribute so it can be used within
   * the updateAttributeAlias method.
   */
  isGrabbed?: boolean = false

  /**
   * Should hold the previously defined Pointer position values.
   */
  previousPointerX?: number
  previousPointerY?: number

  /**
   * Assigns a new Interaction response callback that should end the current
   * interaction. This should stop any interaction when the Pointer position
   * is outside the visible viewport.
   */
  protected assignCurrentDragTimeout() {
    if (this.currentInteraction.response === undefined) {
      this.currentInteraction.response = setTimeout(
        () => this.handleDragEnd(),
        3000
      ) as unknown as number
    }
  }

  /**
   * Clears the existing Interaction response callback and remove the initial
   * timeout ID.
   */
  protected clearCurrentDragTimeout() {
    this.currentInteraction.response && clearTimeout(this.currentInteraction.response)
    this.currentInteraction.response = undefined
  }

  /**
   * Clears any assigned currentInteraction property value that was initially
   * defined.
   */
  protected clearCurrentInteraction() {
    const keys = Object.keys(this.currentInteraction)

    if (!keys.length) {
      this.log(['Unable to clear current Interaction from undefined context', this], 'warning')

      return false
    }

    this.currentInteraction = keys.reduce((previous: any, current) => {
      previous[current] = undefined

      return previous
    }, {})

    this.interactionTarget = undefined
    this.interactionHost = undefined

    return true
  }

  /**
   * Defines the actual interaction target from the optional target Property
   * attribute. The parent Web Component will be used as target fallback or use
   * the initial Slotted Element or This Component as fallback targts.
   */
  protected defineTarget(selector?: string) {
    if (this.interactionTarget) {
      return true
    }

    const target = selector
      ? this.closest(selector) || this.querySelector(selector || '')
      : undefined

    const host = this.useHost(target || this) as any

    // Check if the current Component exists within another Enlightenment
    // component and use the parent as context instead
    if (!this.interactionTarget && !target && host && host !== this) {
      const context = host.useContext && host.useContext()

      if (context && context !== this) {
        this.interactionTarget = context

        this.log(['Current target defined from host context:', context], 'log')
      } else {
        this.interactionTarget = host

        this.log(['Current target defined from host:', context], 'log')
      }
    }

    // Assign the existing parent target defined from the target attribute.
    if (!this.interactionTarget && target) {
      this.interactionTarget = target as HTMLElement
    } else if (!this.interactionTarget) {
      // Use the first slotted Element instead if the custom target is not
      // defined for this Component.
      const initialElement = this.useInitialElement()
      this.interactionTarget = initialElement as HTMLElement

      if (!this.interactionTarget) {
        this.interactionTarget = this as any
      }
    }

    this.log(['Current target defined:', this.interactionTarget], 'log')

    if ((this.interactionTarget as any) !== this) {
      this.interactionHost = this.useHost(this.interactionTarget)
    }

    if (!this.interactionHost) {
      this.interactionHost = this
    }

    return this.interactionTarget ? true : false
  }

  /**
   * Callback handler that should cleanup the current Drag interaction.
   *
   * @param event Inherit the optional Mouse or Touch event interface.
   */
  protected handleDragEnd(
    event?: MouseEvent | TouchEvent,
    options?: EnlightenmentInputControllerCallbackOptions
  ) {
    return new Promise<boolean>((resolve) => {
      try {
        if (
          (event && !this.currentInteraction.event) ||
          (event && !this.isCurrentInteractionEvent(event, this.currentInteraction.event))
        ) {
          return resolve(false)
        }

        this.clearAnimationFrame(this.currentInteraction.request)
        let willRender = false

        if (this.isGrabbed) {
          if (this.currentInteraction.context) {
            willRender = true

            // Cleanup the optional running Drag Timeout.
            this.clearCurrentDragTimeout()

            // Validate the updated position and size and ensure it fits within the
            // visible viewport.
            this.clearAnimationFrame(this.currentInteraction.response)

            this.currentInteraction.response = this.useAnimationFrame(() => {
              this.handleCurrentViewport(this.currentInteraction.context)

              return (
                this.currentInteraction.context &&
                this.handleDragEndCallback(this.currentInteraction.context, resolve, options)
              )
            })
          }
        }

        this.isGrabbed = false

        this.updateAttributeAlias(
          'isGrabbed',
          EnlightenmentInputController.defaults.attr.grabbed,
          true
        )

        this.omitGlobalEvent('mousemove', this.handleDragUpdate)
        this.omitGlobalEvent('mouseup', this.handleDragEnd)
        this.omitGlobalEvent('touchmove', this.handleDragUpdate)
        this.omitGlobalEvent('touchend', this.handleDragEnd)

        !willRender && resolve(false)
      } catch (exception) {
        exception && this.log(exception, 'error')
      }
    })
  }

  /**
   * Callback handler that is called when the current interaction has ended.
   * This method ensures the actual interaction target fit's within the visible
   * viewport.
   *
   * @param context Use the actual interactionTarget from the useContext method.
   * @param resolve Resolver to ensure the callback is handled within the last
   * requested Animation Frame.
   */
  protected handleDragEndCallback(
    context: HTMLElement,
    resolve: EnlightenmentInteractionEndCallback,
    options?: EnlightenmentInputControllerCallbackOptions
  ) {
    const cache = this.useContextCache(context)

    const ariaTarget = this.currentInteraction.context
    ariaTarget && ariaTarget.removeAttribute(EnlightenmentInputController.defaults.attr.grabbed)

    this.clearAnimationFrame(this.currentInteraction.response)

    this.currentInteraction.event &&
      this.throttle(() => {
        console.log('DONE', this.currentInteraction.host)
        resolve(true)
      })
  }

  /**
   * Defines the default Event handler to initiate the Drag interaction for
   * Mouse & Touch devices.
   *
   * @param event The expected Mouse or Touch Event.
   * @param customTarget Use the defined HTMLElement
   * currentInteractionOrigin instead.
   */
  protected handleDragStart(event: MouseEvent | TouchEvent, customTarget?: HTMLElement) {
    if (!event || this.preventEvent) {
      return
    }

    event.preventDefault && event.preventDefault()

    // Ensures to only use the initial Pointer Mouse or Touch Event.
    if (
      this.currentInteraction.event &&
      !this.isCurrentInteractionEvent(event, this.currentInteraction.event)
    ) {
      return
    }

    if (event instanceof MouseEvent) {
      // Only listen for the main Mouse button.x
      if (event.button !== 0) {
        return
      }
    }

    // Keep track of the interction count that enables the usage of secondary
    // interction callbacks.
    if (this.currentInteractionCount === undefined) {
      this.currentInteractionCount = 0
    }

    // Keep track of the amount of interaction updates that is triggered since
    // the initial currentInteraction construction.
    this.currentInteraction.updates = 0

    const target = customTarget || (event.target as HTMLElement)

    //@DEPRECATED
    // if (target && target.hasAttribute(EnlightenmentInputController.defaults.attrPivot)) {
    // }

    if (target) {
      this.currentInteraction.origin = target

      // this.currentInteractionOrigin = target

      // const interaction = target.getAttribute('data-interaction')
      const pivot = EnlightenmentInputController.isInteger(
        target.getAttribute(EnlightenmentInputController.defaults.attr.pivot)
      )

      // this.currentPivot = pivot
      this.currentInteraction.pivot = pivot
    }

    // Apply the Drag behavior on the main Component context, since it should
    // contain all visible elements.
    const context = this.useContext() as HTMLElement

    if (!context) {
      return
    }

    if (!this.currentInteractionCount) {
      this.currentInteraction.context = context
      this.currentInteraction.host = this.interactionHost
    }

    this.currentInteractionCount += 1

    // Enable single & double click interactions
    if (this.currentInteractionCount === 1) {
      this.throttle(() => {
        this.currentInteractionCount = 0
      }, EnlightenmentInputController.RPS)
    }

    if (this.currentInteractionCount > 1) {
      return this.handleDragSecondary(event)
    }

    this.isGrabbed = true

    const [translateX, translateY] = EnlightenmentInputController.parseMatrixValue(
      context.style.transform
    )

    const [clientX, clientY] = this.usePointerPosition(event)

    this.initialPointerX = Math.round(clientX)
    this.initialPointerY = Math.round(clientY)

    //@NEW
    this.currentInteraction = {
      ...this.currentInteraction,
      height: context.offsetHeight,
      left: context.offsetLeft,
      pointerX: clientX,
      pointerY: clientY,
      top: context.offsetTop,
      width: context.offsetWidth,
      x: translateX,
      y: translateY
    }

    // Ensure the method is called only once since a MouseEvent a TouchEvent
    // can be called together.
    if (!this.currentInteraction.event) {
      this.currentInteraction.event = event
    }

    this.handleCurrentElement(this)

    this.assignGlobalEvent('mousemove', this.handleDragUpdate, {
      context: document.documentElement
    })

    this.assignGlobalEvent('touchmove', this.handleDragUpdate, {
      context: document.documentElement
    })

    this.assignGlobalEvent('touchend', this.handleDragEnd, {
      once: true
    })

    this.assignGlobalEvent('mouseup', this.handleDragEnd, { once: true })
  }

  /**
   * Callback handler that should initiate when the secondary Pointer
   * interaction is triggered.
   * @param event
   * @returns
   */
  protected handleDragSecondary(event: MouseEvent | TouchEvent) {
    // Ensure the previous DragEnd method is canceled to ensure it does not
    // interfere with this callback.
    this.currentInteraction.request && cancelAnimationFrame(this.currentInteraction.request)

    this.isGrabbed = false

    const context = this.useContext() as HTMLElement

    if (!context) {
      return
    }

    const position: undefined | string = (this as any).position
    if (position && ['absolute', 'fixed'].includes(position)) {
      this.stretch(context, this.currentInteraction.pivot)

      this.throttle(() => this.requestGlobalUpdate(!this.enableDocumentEvents))
    }
  }

  /**
   * Updates the required Drag position values while isGrabbed equals TRUE.
   *
   * @param event Expected Mouse or Touch event.
   */
  protected handleDragUpdate(event: MouseEvent | TouchEvent) {
    if (!event) {
      this.handleDragEnd()

      return
    }

    // Don't continue if the initial Event instance does not match with the
    // current Event parameter value.
    if (!this.isCurrentInteractionEvent(event, this.currentInteraction.event as any)) {
      return
    }

    const [clientX, clientY] = this.usePointerPosition(event)

    // this.currentInteractionCount += 1
    if (this.currentInteraction.updates !== undefined) {
      this.currentInteraction.updates += 1
    }

    // Overrides the initial Pointer position values when the tolerance is
    // defined.
    if (
      this.currentInteractionTolerance &&
      this.currentInteractionTolerance > (this.currentInteraction.updates || 0)
    ) {
      this.currentInteraction.pointerX = clientX
      this.currentInteraction.pointerY = clientY

      return
    }

    if (this.preventEvent) {
      this.handleDragEnd(event)
      return
    }

    // Only accept movement changes
    if (
      this.currentInteraction.previousPointerX === clientX &&
      this.currentInteraction.previousPointerY === clientY
    ) {
      return
    }

    this.currentInteraction.velocityX =
      clientX > (this.currentInteraction.previousPointerX || 0) ? 1 : -1
    this.currentInteraction.velocityY =
      clientY > (this.currentInteraction.previousPointerY || 0) ? 1 : -1

    if (this.currentInteraction.previousPointerX === clientX) {
      this.currentInteraction.velocityX = 0
    }

    if (this.currentInteraction.previousPointerY === clientY) {
      this.currentInteraction.velocityY = 0
    }

    if (this.isCenterPivot()) {
      const ariaTarget = this.currentInteraction.context

      ariaTarget &&
        !ariaTarget.hasAttribute(EnlightenmentInputController.defaults.attr.grabbed) &&
        ariaTarget.setAttribute(EnlightenmentInputController.defaults.attr.grabbed, 'true')

      if (ariaTarget !== this) {
        this.setAttribute(EnlightenmentInputController.defaults.attr.grabbed, 'true')
      }
    }

    if (clientX !== undefined) {
      this.currentInteraction.previousPointerX = clientX
    }

    if (clientY !== undefined) {
      this.currentInteraction.previousPointerY = clientY
    }

    // @TODO Should use dynamic viewport context.
    const viewport = this.useBoundingRect()

    // Increase the drag precision instead of the a single pixel.
    const precision = Math.ceil(EnlightenmentColorHelper.devicePixelRatio * 2)

    // Assign the current edge for both X & Y axis with the defined threshold.
    //          [top]
    //          -1
    // [left] -1 0 1 [right]
    //           1
    //        [bottom]
    if (clientX <= viewport.left + precision) {
      this.currentInteraction.edgeX = -1
    } else if (clientX >= viewport.width - precision) {
      this.currentInteraction.edgeX = 1
    } else {
      this.currentInteraction.edgeX = 0
    }

    if (clientY <= viewport.top + precision) {
      this.currentInteraction.edgeY = -1
    } else if (clientY >= viewport.height - precision) {
      this.currentInteraction.edgeY = 1
    } else {
      this.currentInteraction.edgeY = 0
    }

    // Failsafe that should exit the current Drag interaction while the current
    // pointer position is outisde the area for a certain duration.
    if (!this.isWithinViewport(clientX, clientY)) {
      this.assignCurrentDragTimeout()
    } else {
      this.clearCurrentDragTimeout()
    }

    this.currentInteraction.request = this.useAnimationFrame(() => {
      const x = clientX - (this.currentInteraction.pointerX || 0)
      const y = clientY - (this.currentInteraction.pointerY || 0)

      this.handleDragUpdateCallback(x, y)
    })

    return true
  }

  /**
   * Placeholder callback that is initiated within the request Animation Frame;
   * triggered by the last Drag Interaction. The actual component can ignore
   * the initial constructor.
   *
   * You can use this callback to call the required methods from your component,
   * like move, resizing or any othcer draggable operation.
   *
   * @param context Should apply any interaction logic on the defined context
   * Element.
   * @param properties Defines the related Pointer data defined from the
   * selected Animation frame; like the Pointer position and delta values.
   */
  protected handleDragUpdateCallback(deltaX: number, deltaY: number) {
    return [deltaX, deltaY]
  }

  /**
   * Defines the global keyboard Event listener for the element context.
   *
   * Unmark the currentElement property from the constructed Enlightenment
   * element during a keyboard event within the element context.
   *
   * @param event The initial Keyboard Event interface.
   */
  protected handleGlobalKeydown(event: KeyboardEvent) {
    if (this.preventEvent) {
      return
    }

    const { keyCode, target } = event || {}

    if (EnlightenmentInputController.keyCodes.exit.includes(keyCode)) {
      this.handleCurrentElement(null)

      // this.commit('currentElement', false)
      const t = target as HTMLElement

      if (t && this.isComponentContext(t) && t.blur) {
        t.blur()
      }
    } else if (!EnlightenmentInputController.keyCodes.meta.includes(keyCode)) {
      this.handleCurrentElement(event.target)
    } else {
      this.throttle(() => {
        this.handleCurrentElement(document.activeElement)
      })
    }
  }

  // protected handleGlobalResize(event?: Event) {

  // }

  /**
   * Compares the defined Event with the current Interaction Event that was
   * assigned during the initial Interaction event.
   *
   * @param event The Event object to compare.
   */
  protected isCurrentInteractionEvent(event: Event, initialEvent?: Event) {
    if (!event || !initialEvent) {
      return false
    }

    if (
      event instanceof MouseEvent &&
      initialEvent &&
      initialEvent instanceof MouseEvent === false
    ) {
      return false
    }

    if (
      event instanceof TouchEvent &&
      initialEvent &&
      initialEvent instanceof TouchEvent === false
    ) {
      return false
    }

    if (event instanceof MouseEvent && initialEvent && initialEvent instanceof MouseEvent) {
      return true
    }

    if (initialEvent instanceof TouchEvent && initialEvent && event instanceof TouchEvent) {
      return true
    }

    return !initialEvent ? true : false
  }

  /**
   * Returns the clientX and clientY of the defined Pointer context.
   *
   * @param event Defines the Event interface from the defined MouseEvent or
   * TouchEvent.
   */
  protected usePointerPosition(event: MouseEvent | TouchEvent) {
    if (!event) {
      return []
    }

    let clientX = 0
    let clientY = 0

    if (event instanceof MouseEvent) {
      clientX = event.clientX
      clientY = event.clientY
    } else if (event instanceof TouchEvent) {
      clientX = event.touches[0].clientX
      clientY = event.touches[0].clientY
    }

    return [clientX, clientY]
  }
}
