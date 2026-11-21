import { createHash, X509Certificate } from "node:crypto";
import { once } from "node:events";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { PROXY_FIXTURE_CERTIFICATE, PROXY_FIXTURE_KEY } from "openclaw/plugin-sdk/test-env";
import { createNodeBootstrapFixture } from "./crabbox-worker-node-enrollment.test-support.js";

export async function serveNodeArtifact(
  onCleanup: (cleanup: () => Promise<void>) => void,
  archive: Buffer,
  options: {
    tls?: boolean;
    redirect?: boolean;
    resetBeforeHeaders?: boolean;
    resetBeforeTls?: boolean;
    statusCodes?: number[];
    hold?: Promise<void>;
  } = {},
) {
  const tls =
    options.tls && !options.resetBeforeTls
      ? { cert: PROXY_FIXTURE_CERTIFICATE, key: PROXY_FIXTURE_KEY }
      : undefined;
  const authorizations: Array<string | undefined> = [];
  const requested = Promise.withResolvers<void>();
  const closed = Promise.withResolvers<void>();
  const handle: http.RequestListener = (request, response) => {
    authorizations.push(request.headers.authorization);
    requested.resolve();
    const statusCode = options.statusCodes?.[authorizations.length - 1];
    if (statusCode) {
      response.writeHead(statusCode);
      response.end();
      return;
    }
    if (options.resetBeforeHeaders) {
      // End the connection before headers in every host runtime; the child must
      // diagnose the peer loss without relying on resetAndDestroy support.
      request.socket.destroy();
      return;
    }
    if (options.redirect) {
      response.writeHead(302, { location: "https://untrusted.example.test/artifact" });
      response.end();
      return;
    }
    response.writeHead(200, { "content-length": archive.length });
    if (options.hold) {
      void options.hold.then(() => response.end(archive));
    } else {
      response.end(archive);
    }
  };
  const server = options.resetBeforeTls
    ? net.createServer((socket) => socket.once("data", () => socket.resetAndDestroy()))
    : tls
      ? https.createServer(tls, handle)
      : http.createServer(handle);
  const sockets = new Set<net.Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => {
      sockets.delete(socket);
      closed.resolve();
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  onCleanup(async () => {
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP artifact server");
  }
  const nodeBootstrap = createNodeBootstrapFixture({
    url: `${options.tls ? "https" : "http"}://127.0.0.1:${address.port}/artifact`,
    sha256: createHash("sha256").update(archive).digest("hex"),
    bytes: archive.length,
    ...(tls ? { tlsFingerprint: new X509Certificate(tls.cert).fingerprint256 } : {}),
  });
  return { nodeBootstrap, authorizations, requested: requested.promise, closed: closed.promise };
}
