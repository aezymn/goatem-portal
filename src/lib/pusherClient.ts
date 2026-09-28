import PusherClient from "pusher-js";

const globalForPusherClient = globalThis as unknown as {
  pusherClient: PusherClient | undefined;
};

// We create a singleton so that we don't open multiple WebSocket connections
export const pusherClient =
  globalForPusherClient.pusherClient ??
  new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPusherClient.pusherClient = pusherClient;
}
