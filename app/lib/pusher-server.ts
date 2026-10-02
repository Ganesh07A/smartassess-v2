import PusherServer from "pusher";

const appId = process.env.PUSHER_APP_ID;
const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
const secret = process.env.PUSHER_SECRET;
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "mt1";

/**
 * True only when all credentials are present. Callers should skip broadcasting when false so a
 * misconfigured deployment degrades gracefully instead of firing requests with "dummy" keys.
 */
export const isPusherConfigured = Boolean(appId && key && secret);

export const pusherServer = new PusherServer({
  appId: appId || "dummy",
  key: key || "dummy",
  secret: secret || "dummy",
  cluster,
  useTLS: true,
});
