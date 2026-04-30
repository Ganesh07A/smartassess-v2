import PusherClient from "pusher-js";

const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

export const pusherClient = (typeof window !== "undefined" && pusherKey)
  ? new PusherClient(pusherKey, {
      cluster: pusherCluster || "ap2",
    })
  : null;
