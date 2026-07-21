/**
 * Fake stand-in for src/services/openrouter.js.
 *
 * `reply` controls what the next call to chat.completions.create() returns.
 * `failNext` makes the next call reject, optionally with a given status.
 */
let nextReply = "Default fake reply";
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
        return { choices: [{ message: { content: nextReply } }] };
      }),
    },
  },
  __setReply(reply) {
    nextReply = reply;
  },
  __failNext(status) {
    const err = new Error("simulated upstream failure");
    if (status) err.status = status;
    failure = err;
  },
};
