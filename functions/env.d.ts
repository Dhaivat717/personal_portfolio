declare module "cloudflare:email" {
  export class EmailMessage {
    readonly from: string;
    readonly to: string;
    constructor(from: string, to: string, raw: ReadableStream | string);
  }
}

interface SendEmail {
  send(message: import("cloudflare:email").EmailMessage): Promise<void>;
}

interface EventContext<Env = unknown> {
  request: Request;
  env: Env;
  waitUntil(promise: Promise<unknown>): void;
}

type PagesFunction<Env = unknown> = (context: EventContext<Env>) => Response | Promise<Response>;
