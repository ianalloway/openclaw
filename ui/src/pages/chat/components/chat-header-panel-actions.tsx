import {
  createMemo,
  createSignal,
  createUniqueId,
  Errored,
  lazy,
  Loading,
  onSettled,
  Show,
  type Element,
} from "solid-js";
import type { BoardWidgetPageMenu } from "../../../components/board/board-widget-cell-options.ts";
import { Icon } from "../../../components/solid/icon.tsx";
import { LazyViewError } from "../../../components/solid/lazy-view-error.tsx";
import {
  createMenuControls,
  Menu,
  type MenuControls,
  type MenuEntry,
  type MenuItem,
  type MenuHandle,
} from "../../../components/solid/menu.tsx";
import { registerChatSessionEnglish } from "../../../i18n/locales/en-chat-session.ts";
import type { KeyboardShortcutCombo } from "../../../lib/keyboard-shortcut-contract.ts";
import { registerEnglishCatalog, t } from "../../../lib/reactive/i18n.ts";
import { listen } from "../../../lib/reactive/listener.ts";
import { ClearCompanion, ExternalPanelLink } from "../chat-panel-header-actions.tsx";
import type { ChatPageHost } from "../chat-state-host.ts";
import type { SidebarLayout, SidebarSlotId } from "../sidebar-layout.ts";
import type { HeaderMenuQuickAction } from "./chat-header-session-menu.ts";
import { chatPaneLayoutModel } from "./chat-pane-layout-model.ts";
import type { SidebarPanelDefinition } from "./chat-sidebar-region-types.ts";

export { chatPaneLayoutModel };

registerEnglishCatalog(registerChatSessionEnglish);

const DashboardContent = lazy(() => import("./chat-header-panel-menu-content.tsx"), {
  export: "ChatDashboardMenuContent",
});
const LayoutContent = lazy(() => import("./chat-header-panel-menu-content.tsx"), {
  export: "ChatPaneLayoutMenuContent",
});

export type HeaderPanelAction = HeaderMenuQuickAction & { shortcut?: KeyboardShortcutCombo };

export type ChatPaneLayoutMenuProps = {
  paneId: string;
  narrow: boolean;
  mobile?: boolean;
  actionsDisabled?: boolean;
  panelMenuActions?: HeaderPanelAction[];
  layoutMenuActions?: HeaderMenuQuickAction[];
  sidebarLayout?: SidebarLayout;
  panelDefinitions?: SidebarPanelDefinition[];
  onLayoutChange?: ChatPageHost["updateSidebarLayout"];
  onToggleSidePanel?: () => void;
  onCloseSidePanel?: (slot: SidebarSlotId) => void;
  onOpenSplitView?: () => void;
  onSplitDown?: (paneId: string) => void;
  onSplitRight?: (paneId: string) => void;
  onClosePane?: (paneId: string) => void;
};

/** Renders definition-owned controls without mounting the panel's content/view. */
export function ChatPanelHeaderActions(
  props: Pick<SidebarPanelDefinition, "headerActionView" | "headerLink"> & {
    controls?: MenuControls;
  },
) {
  return (
    <>
      <Show when={props.headerActionView}>
        {(view) => <ClearCompanion {...view()} actionRef={props.controls?.ref()} />}
      </Show>
      <Show when={props.headerLink}>
        {(link) => <ExternalPanelLink {...link()} actionRef={props.controls?.ref()} />}
      </Show>
    </>
  );
}

type ChatPanelMenuHandlers = {
  items: () => readonly MenuEntry[];
  select: (item: MenuItem, event: CustomEvent<MenuItem>) => void;
};
export type ChatPanelMenuContentProps = {
  menuProps: ChatPaneLayoutMenuProps & { widgetMenu?: BoardWidgetPageMenu };
  controls: MenuControls;
  readMenu: () => MenuHandle | undefined;
  onReady: (handlers: ChatPanelMenuHandlers | undefined) => void;
};

/** Keep registered content and initial focus owned by the same panel menu. */
function createPanelMenu(
  menuProps: ChatPanelMenuContentProps["menuProps"],
  Content: (props: ChatPanelMenuContentProps) => Element,
  id: string,
) {
  const controls = createMenuControls();
  const [handlers, setHandlers] = createSignal<ChatPanelMenuHandlers>();
  let menu: MenuHandle | undefined;
  let openingFocus: globalThis.Element | null | undefined;
  let focusLast = false;
  let stopKeyboard: (() => void) | undefined;
  onSettled(() => () => stopKeyboard?.());
  const focusReady = () => {
    if (!menu?.overlay.open) {
      return;
    }
    const active = menu.overlay.surface.ownerDocument.activeElement;
    if (
      active !== openingFocus &&
      active !== menu.overlay.surface &&
      active !== menu.overlay.surface.ownerDocument.body
    ) {
      return;
    }
    const last = focusLast ? menu.itemElements().at(-1) : undefined;
    if (last) {
      last.focus({ preventScroll: true });
    } else {
      menu.focusFirst();
    }
  };
  const items = (): readonly MenuEntry[] =>
    handlers()?.items() ?? [{ id: "loading", label: t("common.loading"), disabled: true }];
  const entries: MenuEntry[] = [
    {
      kind: "group",
      id,
      get items() {
        return items();
      },
      render: (renderItems) => (
        <Errored
          fallback={(error, reset) => {
            onSettled(focusReady);
            return (
              <LazyViewError error={error()} onRetry={reset} retryRef={controls.ref()} inline />
            );
          }}
        >
          <Loading fallback={renderItems(items)}>
            <Content
              menuProps={menuProps}
              controls={controls}
              readMenu={() => menu}
              onReady={(next) => {
                setHandlers(next);
                if (next) {
                  onSettled(focusReady);
                }
              }}
            />
            {renderItems(items)}
          </Loading>
        </Errored>
      ),
    },
  ];
  return {
    controls,
    items: entries,
    get onSelect() {
      return handlers()?.select;
    },
    bind(this: void, handle: MenuHandle) {
      menu = handle;
      stopKeyboard?.();
      const trigger = handle.overlay.trigger;
      stopKeyboard = trigger
        ? listen(
            trigger,
            "keydown",
            (event) => {
              if (!handle.overlay.open) {
                focusLast = event.key === "ArrowUp";
              }
            },
            true,
          )
        : undefined;
    },
    beforeShow(this: void) {
      openingFocus = menu?.overlay.surface.ownerDocument.activeElement;
    },
    openChange(this: void, open: boolean) {
      if (!open) {
        openingFocus = undefined;
        focusLast = false;
      }
    },
  };
}

/** External Dashboard controls reuse the layout and page-widget owners. */
export function ChatDashboardMenu(
  props: ChatPaneLayoutMenuProps & {
    widgetMenu?: BoardWidgetPageMenu;
  },
) {
  const id = createUniqueId();
  const menu = createPanelMenu(props, DashboardContent, "dashboard-content");
  return (
    <Menu
      controls={menu.controls}
      lazy="while-open"
      id={`chat-dashboard-${id}`}
      label={t("chat.sidePanel.dashboardOptions")}
      class="chat-dashboard-menu"
      panelClass="chat-dashboard-menu__panel"
      placement="bottom-end"
      triggerClass="chat-dashboard-menu__trigger"
      triggerAttributes={{ title: t("chat.sidePanel.dashboardOptions") }}
      trigger={
        <>
          <Icon name="layoutDashboard" />
          <Icon name="chevronDown" class="chat-dashboard-menu__chevron" />
        </>
      }
      items={menu.items}
      ref={menu.bind}
      onBeforeShow={menu.beforeShow}
      onOpenChange={menu.openChange}
      onSelect={menu.onSelect}
    />
  );
}

export function ChatPaneLayoutHeaderActions(props: {
  model: ReturnType<typeof chatPaneLayoutModel>;
  controls?: MenuControls;
  /** Set only when the corresponding visible panel header supplies these controls. */
  omitMain?: boolean;
  omitSide?: boolean;
}) {
  return (
    <>
      <Show when={!props.omitMain}>
        <ChatPanelHeaderActions
          controls={props.controls}
          headerActionView={props.model.mainHeaderActionView}
          headerLink={props.model.mainHeaderLink}
        />
      </Show>
      <Show when={!props.omitSide}>
        <ChatPanelHeaderActions
          controls={props.controls}
          headerActionView={props.model.sideHeaderActionView}
          headerLink={props.model.sideHeaderLink}
        />
      </Show>
    </>
  );
}

let nextLayoutId = 0;

export function ChatPaneLayoutMenu(props: ChatPaneLayoutMenuProps) {
  const id = `chat-pane-layout-${++nextLayoutId}`;
  const menu = createPanelMenu(props, LayoutContent, "layout-content");
  const model = createMemo(() => chatPaneLayoutModel(props));

  return (
    <Show
      when={model().allActions.length > 0 || model().mainHeaderActionView || model().mainHeaderLink}
    >
      <Menu
        controls={menu.controls}
        lazy
        id={id}
        class={[
          "chat-pane__layout-menu chat-panel-layout-menu",
          { "chat-panel-layout-menu--mobile": props.mobile },
        ]}
        placement="bottom-end"
        label={t(props.mobile ? "chat.sessionHeader.panels" : "chat.sessionHeader.layout")}
        triggerClass="btn btn--ghost chat-pane__layout-trigger"
        trigger={
          <>
            <span aria-hidden="true">
              <Icon name={props.mobile ? "panelRightOpen" : "columns2"} />
            </span>
            <Show when={!props.mobile}>{t("chat.sessionHeader.layout")}</Show>
          </>
        }
        items={menu.items}
        ref={menu.bind}
        onBeforeShow={menu.beforeShow}
        onOpenChange={menu.openChange}
        onSelect={menu.onSelect}
      />
    </Show>
  );
}
