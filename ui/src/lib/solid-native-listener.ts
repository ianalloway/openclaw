import { createElementRef } from "./reactive/element-ref.ts";
import { listen } from "./reactive/listener.ts";

/** Preserve native event ordering when an enclosing custom element consumes events. */
export function createNativeListenerRef<EventName extends keyof HTMLElementEventMap>(
  type: EventName,
  handle: (event: HTMLElementEventMap[EventName]) => void,
  options?: boolean | AddEventListenerOptions,
) {
  return createElementRef((element: HTMLElement) => listen(element, type, handle, options));
}

export { createNativeListenerRef as nativeListener };
