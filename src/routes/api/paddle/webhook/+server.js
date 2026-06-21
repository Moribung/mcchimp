import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env as devEnv } from '$env/dynamic/private';

// Paddle webhook → flips profiles.tier when a subscription starts/changes/cancels.
//
// Required env (Cloudflare vars + .dev.vars locally):
//   PADDLE_WEBHOOK_SECRET     — secret key from the Paddle notification destination
//   PADDLE_PRICE_PRO          — Paddle price id for the Pro plan
//   PADDLE_PRICE_MAX          — Paddle price id for the Max plan
//   SUPABASE_SERVICE_ROLE_KEY — already used by /api/generate

// Map a Paddle price id → our tier key.
function tierForPrice(priceId, env) {
  if (priceId && priceId === env.PADDLE_PRICE_PRO) return 'pro';
  if (priceId && priceId === env.PADDLE_PRICE_MAX) return 'max';
  return null;
}

// Cloudflare Workers have no Node 'crypto' — verify with Web Crypto.
// Paddle-Signature header looks like: "ts=1700000000;h1=<hex hmac>"
async function verifySignature(rawBody, sigHeader, secret) {
  const parts = Object.fromEntries(
    sigHeader.split(';').map((kv) => kv.split('=').map((s) => s.trim()))
  );
  if (!parts.ts || !parts.h1) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${parts.ts}:${rawBody}`)
  );
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');

  // constant-time compare
  if (hex.length !== parts.h1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ parts.h1.charCodeAt(i);
  return diff === 0;
}

export async function POST({ request, platform }) {
  // platform.env holds Cloudflare bindings in prod; devEnv ($env/dynamic/private)
  // reads .env.local under `vite dev`. Cloudflare bindings win when present.
  const env = { ...devEnv, ...(platform?.env ?? {}) };
  const SECRET = env.PADDLE_WEBHOOK_SECRET;
  const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SECRET || !SERVICE_ROLE) {
    return json({ error: 'Paddle webhook is not configured on the server.' }, { status: 500 });
  }

  // Verify against the RAW body — re-serializing JSON would break the HMAC.
  const sig = request.headers.get('paddle-signature') || '';
  const raw = await request.text();
  if (!sig || !(await verifySignature(raw, sig, SECRET))) {
    // ── TEMP DEBUG — remove once signature verifies ──
    const parts = Object.fromEntries(
      sig.split(';').map((kv) => kv.split('=').map((s) => s.trim()))
    );
    let computed = '';
    try {
      const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(SECRET),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const mac = await crypto.subtle.sign(
        'HMAC', key, new TextEncoder().encode(`${parts.ts}:${raw}`)
      );
      computed = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      computed = 'ERR:' + e.message;
    }
    return json(
      {
        error: 'Invalid signature.',
        debug: {
          sig_header_present: !!sig,
          ts: parts.ts ?? null,
          received_h1: parts.h1 ?? null,
          received_h1_len: parts.h1?.length ?? 0,
          computed,
          computed_len: computed.length,
          match: computed === parts.h1,
          secret_len: SECRET.length,
          secret_head: SECRET.slice(0, 6),
          secret_tail: SECRET.slice(-4),
          body_len: raw.length
        }
      },
      { status: 401 }
    );
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const data = event.data ?? {};
  // user_id must be passed as customData when opening Paddle.js checkout.
  const userId = data.custom_data?.user_id;
  if (!userId) return json({ received: true }); // nothing to map — ack so Paddle doesn't retry

  let newTier = null;
  switch (event.event_type) {
    case 'subscription.created':
    case 'subscription.updated':
      if (data.status === 'active' || data.status === 'trialing') {
        newTier = tierForPrice(data.items?.[0]?.price?.id, env);
      } else if (data.status === 'canceled' || data.status === 'paused') {
        newTier = 'regular';
      }
      break;
    case 'subscription.canceled':
      newTier = 'regular';
      break;
    default:
      break; // ignore other events but still ack below
  }

  if (newTier) {
    const admin = createClient(PUBLIC_SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false }
    });
    const { error } = await admin.from('profiles').update({ tier: newTier }).eq('id', userId);
    if (error) {
      // Return 500 so Paddle retries the delivery.
      return json({ error: 'Failed to update profile.' }, { status: 500 });
    }
  }

  return json({ received: true });
}
