import { createEffect } from "solid-js";

export function createLiveInputRef(read: () => string) {
  let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined;
  createEffect(read, (value) => {
    // Preserve selection and caret when the native input already holds this draft.
    if (input && input.value !== value) {
      input.value = value;
    }
  });
  return (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
    input = element;
  };
}

export { createLiveInputRef as liveInputValue };
