"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { pusherClient } from "@/lib/pusherClient";

interface PusherListenerProps {
  channelName: string;
  eventName: string;
}

export function PusherListener({ channelName, eventName }: PusherListenerProps) {
  const router = useRouter();

  useEffect(() => {
    // Subscribe to the channel
    const channel = pusherClient.subscribe(channelName);

    // Bind to the event
    channel.bind(eventName, () => {
      // Whenever the event fires, transparently refresh server components
      router.refresh();
    });

    return () => {
      // Clean up when unmounting
      channel.unbind(eventName);
      pusherClient.unsubscribe(channelName);
    };
  }, [channelName, eventName, router]);

  return null;
}
