const { EventEmitter } = require('events');

/**
 * Builds a controllable stand-in for the `http.Server` instance that
 * `app.listen(port, cb)` returns in production. Used by `index.test.js` to
 * exercise `index.js`'s shutdown orchestration without binding a real
 * socket.
 *
 * `server.close(cb)` deliberately stores the callback instead of invoking
 * it synchronously: the forced-timeout shutdown branch is only reachable
 * while a `close()` call is still pending, so an auto-resolving mock would
 * make that branch untestable. Call `flushClose(err)` from a test to
 * resolve it explicitly once assertions on the pending state are done.
 *
 * @returns {{ app: { listen: jest.Mock }, server: EventEmitter, flushClose: (err?: Error) => void }}
 */
function createFakeHttpServer() {
  const server = new EventEmitter();
  let closeCallback = null;
  let listeningPort = null;
  let listeningHost = null;

  server.close = jest.fn((cb) => {
    closeCallback = cb || null;
  });
  server.closeIdleConnections = jest.fn();
  server.closeAllConnections = jest.fn();
  server.address = jest.fn(() => ({ address: listeningHost, port: listeningPort }));

  const app = {
    // Models Node's `http.Server#listen(port[, host][, cb])` overload: the
    // host argument is optional, so the callback may be the 2nd or 3rd arg.
    listen: jest.fn((port, hostOrCb, cb) => {
      listeningPort = port;
      const callback = typeof hostOrCb === 'function' ? hostOrCb : cb;
      listeningHost = typeof hostOrCb === 'string' ? hostOrCb : null;
      if (callback) {
        // Mirrors real Node: `http.Server#listen(port, cb)` registers `cb`
        // as a one-time `'listening'` listener, so it fires with `this`
        // bound to the server — before production code's own
        // `httpServer = server.listen(...)` assignment can possibly have
        // completed, since `EventEmitter#emit` invokes listeners
        // synchronously with the emitter as `this`.
        server.once('listening', callback);
      }
      server.emit('listening');
      return server;
    }),
  };

  function flushClose(err) {
    const cb = closeCallback;
    closeCallback = null;
    if (cb) {
      cb(err);
    }
  }

  return { app, server, flushClose };
}

module.exports = { createFakeHttpServer };
