// The bot's heartbeat: a Netlify scheduled function polling for mentions.
//
// Every 5 minutes, not faster: on a cold start each run creates a session,
// and com.atproto.server.createSession is rate-limited per account per day.
// Warm instances reuse the cached session.
//
// Required environment (Site settings -> Environment variables):
//   BOT_IDENTIFIER    the bot account handle, e.g. found-haiku.bsky.social
//   BOT_APP_PASSWORD  an app password (Settings -> App Passwords), never the real one
//   BOT_PINNED_URL    the pinned usage post, linked from every error reply

import { pollOnce } from '../../bot/run.js';

export default async () => {
  try {
    const r = await pollOnce();
    return Response.json(r);
  } catch (e) {
    console.error('poll failed:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
};

export const config = { schedule: '*/5 * * * *' };
