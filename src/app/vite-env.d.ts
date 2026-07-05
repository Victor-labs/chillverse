/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Optional — voice/video calling works with STUN-only (no TURN) for peers on
   *  open/moderate NATs. Set these to add a TURN relay for reliability behind
   *  strict NATs/firewalls. See src/features/chat/calling/webrtcConfig.ts. */
  readonly VITE_TURN_URL?: string
  readonly VITE_TURN_USERNAME?: string
  readonly VITE_TURN_CREDENTIAL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
