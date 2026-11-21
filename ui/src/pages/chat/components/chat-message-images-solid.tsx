import type { JSX } from "@solidjs/web";
import { For, Show, createMemo, useContext } from "solid-js";
import { registerChatComposerEnglish } from "../../../i18n/locales/en-chat-composer.ts";
import { registerChatMediaEnglish } from "../../../i18n/locales/en-chat-media.ts";
import { isInlineImageSource } from "../../../lib/chat/message-extract.ts";
import { chatImageDisplayKey } from "../../../lib/chat/row-display-facts.ts";
import { registerEnglishCatalog } from "../../../lib/reactive/i18n.ts";
import { ContentPresentation } from "../../../lib/solid/presentation.ts";
import { ImageFrame } from "./chat-image-frame.tsx";
import type { ChatImagePreviewSize } from "./chat-image-preview-size.ts";
import { chatImageRenditionWidth } from "./chat-image-rendition.ts";
import { openMessageImage, withMessageImageGallery } from "./chat-message-image-open.ts";
import {
  type MessageImageProps,
  createMessageImagePresentation,
} from "./chat-message-image-presentation.tsx";
import { isCanonicalInboundMediaSource } from "./chat-message-local-media.ts";
import type { MessageMediaAction } from "./chat-message-media-actions.ts";
import type { ImageBlock, ImageRenderOptions } from "./chat-message-media.ts";
import { ChatRowDisplayContext } from "./chat-row-display-context.ts";

registerEnglishCatalog(registerChatComposerEnglish);

registerEnglishCatalog(registerChatMediaEnglish);

export type MessageImagesProps = {
  images: ImageBlock[];
  previewBounds?: ChatImagePreviewSize;
  options?: ImageRenderOptions;
  previews?: JSX.Element[];
};

export function MessageImages(props: MessageImagesProps): JSX.Element {
  const display = useContext(ChatRowDisplayContext);
  let slots: {
    image: ImageBlock;
    key: symbol;
    options: ImageRenderOptions;
    thumbnail?: Blob;
    displayScope?: string;
    displayKey?: string;
  }[] = [];
  let scope = "";
  let policyKey: string | undefined;
  let canonicalMessageKey: string | undefined;
  let localSubmission = false;
  const projection = createMemo(() => {
    const images = props.images;
    const options = props.options;
    const row = display?.()?.read();
    const nextScope = JSON.stringify([
      options?.connectionEpoch,
      options?.authToken?.trim(),
      options?.resourceBasePath,
      options?.sessionKey,
      options?.agentId,
    ]);
    const continuing =
      scope === nextScope &&
      (!localSubmission || options?.localSubmission !== false) &&
      (canonicalMessageKey === options?.canonicalMessageKey ||
        (localSubmission && !canonicalMessageKey));
    const nextLocalSubmission = continuing ? localSubmission : options?.localSubmission === true;
    const adoptingSlots =
      continuing &&
      nextLocalSubmission &&
      images.length === slots.length &&
      slots.every(({ image }) => isInlineImageSource(image.url)) &&
      images.every((image) => image.factIndex !== undefined);
    const previousImages = adoptingSlots
      ? images.toSorted((left, right) => (left.factIndex ?? 0) - (right.factIndex ?? 0))
      : slots.map(({ image }) => image);
    const previousSlots = new Map(
      previousImages.map((image, index) => [image.factIndex, slots[index]?.key]),
    );
    // Publish options with the slot key so retiring images keep their previous policy.
    const imageOptions = withMessageImageGallery(options, images);
    slots = images.map((image, index) => {
      const slot = slots[index];
      const displayKey = row && chatImageDisplayKey(image, chatImageRenditionWidth("inline"));
      const thumbnail = displayKey ? row?.facts?.images?.[displayKey]?.thumbnail : undefined;
      const sameDisplay =
        thumbnail &&
        slot?.thumbnail === thumbnail &&
        slot.displayScope === row?.scope &&
        slot.displayKey === displayKey;
      const sameScope = !slot?.thumbnail || slot.displayScope === row?.scope;
      const previous =
        image.factIndex !== undefined
          ? previousSlots.get(image.factIndex)
          : slot?.image.factIndex === undefined
            ? slot?.key
            : undefined;
      const preservePresentation =
        policyKey === options?.policyKey ||
        isInlineImageSource(image.url) ||
        (image.url !== undefined && isCanonicalInboundMediaSource(image.url));
      return {
        image,
        // Hello changes read authority; identical scoped display bytes keep their native IMG.
        key:
          (sameScope && ((continuing && preservePresentation) || sameDisplay) && previous) ||
          Symbol("image-slot"),
        options: imageOptions,
        thumbnail,
        displayScope: thumbnail ? row?.scope : undefined,
        displayKey: thumbnail ? displayKey : undefined,
      };
    });
    scope = nextScope;
    policyKey = options?.policyKey;
    canonicalMessageKey = options?.canonicalMessageKey;
    localSubmission =
      nextLocalSubmission &&
      !(options?.canonicalMessageKey && images.every((image) => image.factIndex !== undefined));
    return slots;
  });
  const count = () => props.images.length + (props.previews?.length ?? 0);
  return (
    <Show when={count()}>
      <div
        class={[
          "chat-message-images",
          {
            "chat-message-images--single": count() === 1,
            "chat-message-images--gallery": count() !== 1,
            "chat-message-images--two-column": count() === 2 || count() === 4,
            "chat-message-images--five": count() === 5,
          },
        ]}
      >
        <For each={projection()} keyed={(slot) => slot.key}>
          {(slot) => (
            <MessageImage
              image={slot().image}
              options={slot().options}
              previewBounds={props.previewBounds}
            />
          )}
        </For>
        {props.previews}
      </div>
    </Show>
  );
}

function MessageImage(props: MessageImageProps): JSX.Element {
  const presented = useContext(ContentPresentation);
  // Inline bytes have no remote resource custody and can retain decoded pixels while parked.
  return (
    <Show when={presented() || isInlineImageSource(props.image.url)}>
      {(_presented) => {
        const view = createMessageImagePresentation(props);
        return (
          <Show when={view.model().key} keyed>
            {(_key) => (
              <ImageFrame
                model={view.model()}
                presentation={view}
                options={props.options}
                previewBounds={props.previewBounds}
              />
            )}
          </Show>
        );
      }}
    </Show>
  );
}

/** Catalogs consume the same admitted image resource and viewer as transcript tiles. */
export function MessageImageAction(
  props: MessageImageProps & { render: (action: () => MessageMediaAction) => JSX.Element },
): JSX.Element {
  // Match the transcript slot's retirement when its scope or policy changes.
  const scope = () =>
    JSON.stringify([
      props.options.sessionKey,
      props.options.agentId,
      props.options.connectionEpoch,
      props.options.resourceBasePath,
      props.options.authToken,
      props.options.policyKey,
      props.options.canonicalMessageKey,
    ]);
  return (
    <Show when={scope()} keyed>
      {(_scope) => {
        const presentation = createMessageImagePresentation(props);
        const action = createMemo<MessageMediaAction>(() => {
          const { actions, state, reason, previewUrl } = presentation.model();
          return {
            ...actions,
            pending: state === "loading",
            reason,
            previewUrl,
            observeElement: presentation.observeFrame,
            onFocus: state === "unavailable" ? undefined : presentation.admit,
            onOpen: previewUrl
              ? () => openMessageImage(props.image, previewUrl, props.options)
              : undefined,
          };
        });
        return <>{props.render(action)}</>;
      }}
    </Show>
  );
}
