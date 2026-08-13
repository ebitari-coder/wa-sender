declare module "whatsapp-web.js" {
  export class Client {
    constructor(options?: {
      authStrategy?: unknown;
      puppeteer?: {
        headless?: boolean;
        args?: string[];
      };
      authTimeoutMs?: number;
      takeoverOnConflict?: boolean;
    });
    on(event: string, listener: (...args: never[]) => void): void;
    initialize(): Promise<void>;
    destroy(): Promise<void>;
    sendMessage(to: string, content: unknown, options?: unknown): Promise<unknown>;
    info: {
      wid: { user: string };
      pushname?: string;
    };
    pupPage: {
      isClosed(): boolean;
      url(): string;
    };
  }

  export class LocalAuth {
    constructor(options?: { dataPath?: string; clientId?: string });
  }

  export class MessageMedia {
    static fromFilePath(path: string): unknown;
  }
}
