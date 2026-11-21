interface EventContext<Env = unknown> {
  request: Request;
  env: Env;
  waitUntil(promise: Promise<unknown>): void;
}

type PagesFunction<Env = unknown> = (context: EventContext<Env>) => Response | Promise<Response>;
