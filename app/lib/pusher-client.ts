import PusherClient from "pusher-js";

const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

export const pusherClient = (typeof window !== "undefined" && pusherKey)
  ? new PusherClient(pusherKey, {
      cluster: pusherCluster || "ap2",
      // Channels are `private-*` so every subscription is authorized by our own endpoint,
      // which verifies that the caller owns (teacher) or attends (student) that exam.
      channelAuthorization: {
        endpoint: "/api/pusher/auth",
        transport: "ajax",
      },
    })
  : null;
