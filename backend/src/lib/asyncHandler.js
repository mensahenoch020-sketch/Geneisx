// Express 4 doesn't catch a rejected promise thrown inside an
// `async (req, res) => {...}` route handler — if one throws, the request
// hangs or the connection drops instead of reaching the centralized error
// handler in index.js. Wrap any async route handler in this so a thrown
// error becomes a real JSON error response instead of a silent failure.
//
// Usage: router.get("/", asyncHandler(async (req, res) => { ... }));
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
