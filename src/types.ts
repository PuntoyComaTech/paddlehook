import type { PaddleEventType, PaddleWebhookEvent } from "./events"

export interface PaddleBaseEnv {
  PADDLE_WEBHOOK_SECRET: string
}

export interface PaddleWorkerEnv extends PaddleBaseEnv {
  TARGET_URL: string
  INTERNAL_AUTH_TOKEN: string
}

export interface HandlerOptions<TEnv extends PaddleBaseEnv = PaddleBaseEnv> {
  events?: PaddleEventType[]
  onVerified?: (event: PaddleWebhookEvent, env: TEnv) => Response | Promise<Response>
}
