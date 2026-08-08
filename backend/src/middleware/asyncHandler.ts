import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 does not catch a rejected promise from an async route handler —
// it becomes an unhandled rejection and crashes the whole process (Node
// terminates on an uncaught exception by default). Every route in this app
// is async, so without this wrapper a single failing external call (Stripe,
// the mock gateway) takes down the entire backend replica for every other
// in-flight request, not just the one that failed. Wrapping forwards the
// rejection to Express's error pipeline (app.ts's error-handling
// middleware) instead.
export function asyncHandler<Req extends Request = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req as Req, res, next).catch(next);
  };
}
