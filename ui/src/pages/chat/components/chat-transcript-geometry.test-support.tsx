import type { ApplicationContext } from "../../../app/context.ts";
import { projectChatFields } from "../chat-field-projection.ts";
import { ChatPaneRuntime } from "../chat-pane-render.ts";
import { saveChatSessionScrollPosition } from "../scroll.ts";
import type { ChatWidgetLayout } from "../session-message-cache.ts";
import type { ChatThreadProps } from "./chat-thread-interactions.ts";
import { ChatThread } from "./chat-thread-view.tsx";
import type { ChatTranscript } from "./chat-transcript-controller.ts";
import { ChatSessionVirtualizerHost } from "./chat-transcript-virtualizer-host.ts";
import { threadProps } from "./chat-transcript.test-support.ts";

export function geometryMessages(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `Row ${index}`,
    timestamp: index + 1,
    __openclaw: { id: `geometry-row-${index}` },
  }));
}

export class GeometryPane extends ChatPaneRuntime {
  session: ChatSessionVirtualizerHost | undefined;
  fixtureStream: string | null = null;
  fixtureHistory = false;
  fixtureMessages: unknown[] = [];
  private rowHeight = 120;
  private fixtureWidgetLayout?: ChatWidgetLayout;

  initialize(
    context: ApplicationContext,
    followEnd = false,
    rowHeight = followEnd ? 360 : 120,
    widgetLayout?: ChatWidgetLayout,
    scrollTop = 0,
    messages?: unknown[],
  ) {
    projectChatFields(this, ["fixtureStream", "fixtureHistory", "fixtureMessages"]);
    this.context = context;
    this.paneId = "geometry-render";
    this.sessionKey = "agent:main:geometry-render";
    this.rowHeight = rowHeight;
    this.fixtureWidgetLayout = widgetLayout;
    this.fixtureMessages = messages ?? geometryMessages(100);
    saveChatSessionScrollPosition(this.paneId, this.sessionKey, {
      scrollTop,
      anchorToEnd: followEnd,
    });
  }

  renderGeometry() {
    this.transcript.renderSession(this.sessionKey, (session) => {
      if (!(session instanceof ChatSessionVirtualizerHost)) {
        throw new Error("Expected the session virtualizer owner");
      }
      this.session = session;
    });
    return {
      layout: {
        component: GeometryLayout,
        props: {
          transcript: this.transcript,
          thread: threadProps(this.paneId, this.sessionKey, this.fixtureMessages, {
            stream: this.fixtureStream,
            assistantName: "Assistant",
            historyPagination: this.fixtureHistory
              ? { hasMore: true, loading: false, onShowEarlier: () => {} }
              : undefined,
            widgetLayout: this.fixtureWidgetLayout,
          }),
          rowHeight: this.rowHeight,
        },
      },
      dialog: undefined,
      capabilityDialogs: undefined,
      providerReviewSource: undefined,
    };
  }
}

function GeometryLayout(props: {
  transcript: ChatTranscript;
  thread: ChatThreadProps;
  rowHeight: number;
}) {
  return (
    <div
      class="geometry-transcript-fixture"
      style={{ "--geometry-row-height": `${props.rowHeight}px` }}
    >
      <style>{`
        .geometry-transcript-fixture .chat-thread-viewport {
          height: 400px; flex: none; padding: 20px 0;
        }
        .geometry-transcript-fixture .chat-thread { overflow-anchor: none; }
        .geometry-transcript-fixture .chat-virtual-row { height: var(--geometry-row-height); }
      `}</style>
      <ChatThread props={props.thread} transcript={props.transcript} />
    </div>
  );
}
