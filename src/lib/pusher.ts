import PusherServer from "pusher";

// To avoid initializing multiple Pusher instances during hot-reloads in dev
const globalForPusher = globalThis as unknown as {
  pusherServer: PusherServer | undefined;
};

export const pusherServer =
  globalForPusher.pusherServer ??
  new PusherServer({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    useTLS: true,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPusher.pusherServer = pusherServer;
}
