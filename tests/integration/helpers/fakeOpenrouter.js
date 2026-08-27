/**
 * Fake stand-in for src/services/openrouter.js.
 *
 * `reply` controls what the next call to chat.completions.create() returns.
 * `failNext` makes the next call reject, optionally with a given status.
 */
let nextReply = "Default fake reply";
let nextStream = null;
let failure = null;

module.exports = {
  chat: {
    completions: {
      create: jest.fn(async () => {
        if (failure) {
          const err = failure;
          failure = null;
          throw err;
        }
        if (nextStream) {
          const stream = nextStream;
          nextStream = null;
          return stream;
        }
        return { choices: [{ message: { content: nextReply } }] };
      }),
    },
  },
  __setReply(reply) {
    nextReply = reply;
  },
  __setStream(chunks) {
    nextStream = (async function* () {
      for (const content of chunks) {
        yield { choices: [{ delta: { content } }] };
      }
    })();
  },
  __failNext(status) {
    const err = new Error("simulated upstream failure");
    if (status) err.status = status;
    failure = err;
  },
};
