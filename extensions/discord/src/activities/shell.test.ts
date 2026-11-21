import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
import { DISCORD_ACTIVITY_SHELL_JS } from "./shell.js";

// Mobile/web clients may not expose AbortSignal.timeout().
const browserGlobals = { AbortController, AbortSignal: {}, Response, URL, URLSearchParams };

class TestElement {
  className = "";
  textContent = "";
  readonly children: TestElement[] = [];

  set innerHTML(value: string) {
    if (value === "") {
      this.children.length = 0;
    }
  }

  append(...children: TestElement[]) {
    this.children.push(...children);
  }
}

it.each([
  { request: "token", phase: "fetch", timeoutMs: 35_000 },
  { request: "widget", phase: "body", timeoutMs: 20_000 },
] as const)("bounds a hung $request $phase", async ({ request, phase, timeoutMs }) => {
  const app = new TestElement();
  class DiscordSDK {
    customId = "widget-1";
    instanceId = "instance-1";
    commands = {
      authorize: async () => ({ code: "discord-code" }),
      authenticate: async () => ({}),
    };

    async ready() {}
  }

  let timeoutCallback: (() => void) | undefined;
  const clearTimeoutMock = vi.fn(() => {
    timeoutCallback = undefined;
  });
  const setTimeoutMock = vi.fn((callback: () => void) => {
    timeoutCallback = callback;
    return 1;
  });
  const stallUntilAbort = (signal: AbortSignal | null | undefined) =>
    new Promise<never>((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    if (request === "widget" && input === "./api/token") {
      return Response.json({ access_token: "access", session_token: "session" });
    }
    const signal = init?.signal;
    if (phase === "fetch") {
      return await stallUntilAbort(signal);
    }
    const response = Response.json({});
    response.json = () => stallUntilAbort(signal);
    return response;
  });

  runInNewContext(
    DISCORD_ACTIVITY_SHELL_JS.replace(
      'import { DiscordSDK } from "./vendor/embedded-app-sdk.mjs";\n\n',
      "",
    ),
    {
      ...browserGlobals,
      DiscordSDK,
      clearTimeout: clearTimeoutMock,
      document: {
        querySelector: (selector: string) => (selector === "#app" ? app : null),
        createElement: () => new TestElement(),
      },
      fetch: fetchMock,
      setTimeout: setTimeoutMock,
      window: {
        location: new URL("https://123456.discordsays.com"),
        parent: { opener: null },
        addEventListener: vi.fn(),
      },
    },
  );

  const expectedRequestCount = request === "token" ? 1 : 2;
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(expectedRequestCount));
  expect(timeoutCallback).toBeTypeOf("function");
  timeoutCallback?.();
  await vi.waitFor(() => expect(app.children[0]?.children[0]?.textContent).toBe("Gateway offline"));
  expect(fetchMock).toHaveBeenCalledTimes(expectedRequestCount);
  expect(setTimeoutMock).toHaveBeenCalledTimes(expectedRequestCount);
  expect(setTimeoutMock).toHaveBeenLastCalledWith(expect.any(Function), timeoutMs);
  expect(clearTimeoutMock).toHaveBeenCalledTimes(expectedRequestCount);
});

it.each(["parent", "popout"] as const)("only delivers messages from the %s RPC window", (mode) => {
  const opener = mode === "popout" ? {} : null;
  const parent = { opener };
  const addEventListener =
    vi.fn<(name: string, listener: (event: MessageEvent) => void, capture: boolean) => void>();
  const ready = vi.fn(() => new Promise<void>(() => {}));
  const DiscordSDK = class {
    ready = ready;
    constructor() {
      expect(addEventListener).toHaveBeenCalledWith("message", expect.any(Function), true);
    }
  };
  runInNewContext(DISCORD_ACTIVITY_SHELL_JS.replace(/^import[^\n]+\n/, ""), {
    document: { querySelector: () => new TestElement() },
    window: { location: new URL("https://123456.discordsays.com"), parent, addEventListener },
    DiscordSDK,
  });
  expect(ready).toHaveBeenCalledOnce();
  const listener = addEventListener.mock.calls[0]?.[1];
  if (!listener) {
    throw new Error("Expected the Discord RPC message listener to be registered");
  }
  const stopImmediatePropagation = vi.fn();
  const source = opener ?? parent;
  for (const data of [
    [0, {}],
    [1, { cmd: "DISPATCH", evt: "READY" }],
    [1, { cmd: "AUTHORIZE", evt: null }],
    [1, { cmd: "AUTHENTICATE", evt: null }],
    [1, { cmd: "CAPTURE_LOG", evt: null }],
    [2, { code: 1000 }],
    [3, {}],
  ]) {
    listener({ source, data, stopImmediatePropagation } as unknown as MessageEvent);
    expect(stopImmediatePropagation).not.toHaveBeenCalled();
  }
  for (const data of [
    [1, { cmd: "GET_RELATIONSHIPS", evt: null }],
    [1, { cmd: "DISPATCH", evt: "RELATIONSHIP_UPDATE" }],
  ]) {
    stopImmediatePropagation.mockClear();
    listener({ source, data, stopImmediatePropagation } as unknown as MessageEvent);
    expect(stopImmediatePropagation).toHaveBeenCalledOnce();
  }
  for (const untrustedSource of [{}, null]) {
    stopImmediatePropagation.mockClear();
    listener({ source: untrustedSource, stopImmediatePropagation } as unknown as MessageEvent);
    expect(stopImmediatePropagation).toHaveBeenCalledOnce();
  }
});
