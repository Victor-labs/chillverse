// supabase/functions/halo-ai-chat/index.ts
//
// Halo AI — Chillverse's in-app companion chatbot.
// Flow: auth -> daily limit check -> gatekeeper (on-topic?) -> main pass
// with tool calling (knowledge base + player's own data) -> log -> answer.
//
// Model routing (Groq): gatekeeper = openai/gpt-oss-20b, main = openai/gpt-oss-120b.
// NOTE: the build spec originally asked for llama-3.1-8b-instant as the
// gatekeeper model — Groq deprecated it on 2026-06-17 in favor of
// openai/gpt-oss-20b, so that's what's wired in here instead.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE_DAILY_LIMIT = 5
const INCREASED_DAILY_LIMIT = 10
const INCREASED_TIER_VERSION = 2
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GATEKEEPER_MODEL = 'openai/gpt-oss-20b'
const MAIN_MODEL = 'openai/gpt-oss-120b'

const SYSTEM_PROMPT = `You are Halo, the companion AI inside the Chillverse app (the app is called
"Chillverse" — always spell it exactly that way). You ONLY answer questions
about Chillverse — its features, mechanics, how things work, and the player's own
in-app data. You give helpful, friendly, concise suggestions related to the app.

If a question is unrelated to Chillverse (general knowledge, other apps, personal
advice unrelated to the game, etc.), politely decline and redirect the player back
to Chillverse topics. Do not answer unrelated questions even if asked repeatedly.

You have exactly three tools available, and their names are exactly as given —
never invent or guess a different tool name:
- get_chillverse_knowledge — search Chillverse's knowledge base for game mechanics/features
- search_support_articles — search Chillverse's official help center (account, billing, how-tos)
- get_player_data — fetch the current player's own stats, ranks, and recent activity

Use them to look up real player data or documented facts before answering — never
guess or invent facts about the app's mechanics, features, or a player's stats.
Once you have enough information from your tool calls, answer directly — don't keep
calling tools if you already have what you need to respond.`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_chillverse_knowledge',
      description: 'Search the Chillverse knowledge base for facts about app features, mechanics, or FAQs.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Keywords describing what the player is asking about' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_support_articles',
      description: "Search Chillverse's official help center for account, billing, and how-to articles (published, human-written content).",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Keywords describing what the player needs help with' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_player_data',
      description: "Fetch the current player's own stats, game ranks, and recent activity to personalize the answer.",
      parameters: {
        type: 'object',
        properties: {
          player_id: { type: 'string' },
        },
        required: ['player_id'],
      },
    },
  },
]

interface GroqMessage {
  role: string
  content: string | null
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[]
  tool_call_id?: string
  name?: string
}

class GroqToolUseError extends Error {}

async function callGroq(groqKey: string, model: string, messages: GroqMessage[], tools?: unknown[]) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      ...(tools ? { tools, tool_choice: 'auto' } : {}),
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    // The model can occasionally hallucinate a tool name that wasn't
    // offered (e.g. "get_chillworld_knowledge" instead of
    // "get_chillverse_knowledge") — Groq validates this server-side and
    // rejects the whole completion. Tag this specific case so the caller
    // can retry without tools instead of failing the request outright.
    if (res.status === 400 && errText.includes('tool_use_failed')) {
      throw new GroqToolUseError(`Groq tool-call validation failed: ${errText}`)
    }
    throw new Error(`Groq API error (${res.status}): ${errText}`)
  }
  return res.json()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // ── Auth: player_id is ALWAYS derived from the verified session, never
    //    trusted from the request body — matches every other RPC/edge
    //    function in this app. ──
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '').trim()
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: userData, error: userError } = await authClient.auth.getUser(jwt)
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
    const playerId = userData.user.id

    const body = await req.json()
    const question: string = (body?.question ?? '').toString().trim()
    if (!question) {
      return new Response(JSON.stringify({ error: 'question is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const groqKey = Deno.env.get('GROQ_API_KEY')
    if (!groqKey) {
      console.error('halo-ai-chat: GROQ_API_KEY not set')
      return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const today = new Date().toISOString().slice(0, 10)

    // ── 1. Daily limit check — BEFORE any paid API call ──
    const { data: profileForLimit } = await admin
      .from('profiles')
      .select('version_level')
      .eq('id', playerId)
      .maybeSingle()

    const isIncreasedTier = (profileForLimit?.version_level ?? 0) >= INCREASED_TIER_VERSION
    const dailyLimit = isIncreasedTier ? INCREASED_DAILY_LIMIT : BASE_DAILY_LIMIT
    const limitTier = isIncreasedTier ? 'increased' : 'base'

    const { data: usageRow } = await admin
      .from('halo_ai_usage')
      .select('question_count')
      .eq('player_id', playerId)
      .eq('usage_date', today)
      .maybeSingle()

    const countSoFar = usageRow?.question_count ?? 0

    if (countSoFar >= dailyLimit) {
      return new Response(JSON.stringify({ error: 'limit_reached', limit_tier: limitTier, remaining: 0 }), {
        status: 429,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // ── 2. Gatekeeper pass — cheap/fast on-topic check. Declines do NOT
    //    count toward the daily limit (spec default). ──
    const gatekeeperResult = await callGroq(groqKey, GATEKEEPER_MODEL, [
      {
        role: 'system',
        content:
          'You classify whether a question is about Chillverse (a social gaming app — its features, mechanics, ' +
          'how-tos, or the player\'s own in-app stats/progress). Reply with exactly one word: YES or NO. ' +
          'Nothing else.',
      },
      { role: 'user', content: question },
    ])
    const gatekeeperAnswer: string = gatekeeperResult?.choices?.[0]?.message?.content?.trim().toUpperCase() ?? ''
    const isOnTopic = gatekeeperAnswer.startsWith('YES')

    if (!isOnTopic) {
      return new Response(
        JSON.stringify({
          answer:
            "I can only help with Chillverse stuff — features, mechanics, how-tos, or your own stats. " +
            "Ask me something about the app and I'm on it!",
          limit_tier: limitTier,
          remaining: dailyLimit - countSoFar,
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // ── 3. On-topic — this question counts. Increment (upsert) now. ──
    const newCount = countSoFar + 1
    await admin.from('halo_ai_usage').upsert(
      { player_id: playerId, usage_date: today, question_count: newCount },
      { onConflict: 'player_id,usage_date' },
    )

    // ── 4. Main pass with tool calling ──
    const messages: GroqMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: question },
    ]

    let toolCallsLog: unknown[] = []
    let finalAnswer = ''

    // Allow up to 2 rounds of tool calls, then force a plain-text answer on
    // the final round by not offering tools at all — this guarantees the
    // model produces real content instead of looping on tool calls forever
    // and hitting the generic "couldn't come up with an answer" fallback.
    const MAX_ROUNDS = 3
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const isLastRound = round === MAX_ROUNDS - 1
      let result
      try {
        result = await callGroq(groqKey, MAIN_MODEL, messages, isLastRound ? undefined : TOOLS)
      } catch (err) {
        if (err instanceof GroqToolUseError) {
          // The model hallucinated a tool name — drop tools entirely and
          // force a plain-text answer from whatever context we have so far,
          // rather than failing the whole request.
          console.error('halo-ai-chat: tool hallucination, retrying without tools:', err.message)
          result = await callGroq(groqKey, MAIN_MODEL, messages, undefined)
        } else {
          throw err
        }
      }
      const choice = result?.choices?.[0]
      const msg = choice?.message

      if (!msg?.tool_calls?.length) {
        finalAnswer = msg?.content ?? "Sorry, I couldn't come up with an answer just now — try again in a moment."
        break
      }

      messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls })

      for (const call of msg.tool_calls) {
        const fnName = call.function.name
        let args: Record<string, unknown> = {}
        try { args = JSON.parse(call.function.arguments || '{}') } catch { /* ignore malformed args */ }

        toolCallsLog.push({ name: fnName, arguments: args })

        let toolResult: unknown = null

        if (fnName === 'get_chillverse_knowledge') {
          const query = (args.query as string) ?? ''
          const { data } = await admin
            .from('chillverse_knowledge')
            .select('title, content, tags')
            .eq('is_active', true)
            .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
            .limit(5)
          toolResult = data ?? []
        } else if (fnName === 'search_support_articles') {
          const query = (args.query as string) ?? ''
          const { data } = await admin
            .from('support_articles')
            .select('title, summary, content, tags')
            .eq('is_published', true)
            .or(`title.ilike.%${query}%,summary.ilike.%${query}%,content.ilike.%${query}%`)
            .limit(5)
          toolResult = data ?? []
        } else if (fnName === 'get_player_data') {
          // player_id argument from the model is IGNORED — always scope to
          // the authenticated caller, exactly like every other tool/RPC in
          // this app. A player can only ever fetch their own data.
          const [{ data: profileData }, { data: ranksData }, { data: sessionsData }] = await Promise.all([
            admin
              .from('profiles')
              .select('username, xp, level, streak, is_pro, pro_tier, version_level, referral_count, last_active_date')
              .eq('id', playerId)
              .maybeSingle(),
            admin
              .from('player_game_ranks')
              .select('game, rank, current_streak, all_time_streak')
              .eq('user_id', playerId),
            admin
              .from('game_sessions')
              .select('game, result, played_at')
              .eq('user_id', playerId)
              .order('played_at', { ascending: false })
              .limit(5),
          ])
          toolResult = {
            profile: profileData ?? {},
            ranks: ranksData ?? [],
            recent_games: sessionsData ?? [],
          }
        } else {
          toolResult = { error: `Unknown tool: ${fnName}` }
        }

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: fnName,
          content: JSON.stringify(toolResult),
        })
      }
    }

    if (!finalAnswer) {
      finalAnswer = "Sorry, I couldn't come up with an answer just now — try again in a moment."
    }

    // ── 5. Log the exchange ──
    await admin.from('halo_ai_logs').insert({
      player_id: playerId,
      question,
      answer: finalAnswer,
      tool_calls: toolCallsLog.length ? toolCallsLog : null,
    })

    return new Response(JSON.stringify({ answer: finalAnswer, limit_tier: limitTier, remaining: Math.max(0, dailyLimit - newCount) }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('halo-ai-chat error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
