import { useCallback, useRef, useEffect } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";

export type IncomingPayload = {
  type: string;
  payload?: any;
};

export function useDiscordWs(onMessage: (data: IncomingPayload) => void) {
  const subscribedRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<string[]>([]);
  const handlerRef = useRef(onMessage);

  // Keep latest handler without re-establishing the socket
  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  function getSocketUrl() {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const scheme = isHttps ? 'wss' : 'ws';
    const host = (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
    const port = 3000;
    return `${scheme}://${host}:${port}`;
  }

  const { sendMessage, lastMessage, readyState } = useWebSocket(getSocketUrl(), {
    onOpen: () => {
      // Flush any pending subscriptions and re-subscribe after reconnect
      const unique = new Set([...subscribedRef.current, ...pendingRef.current]);
      pendingRef.current = [];
      unique.forEach((channelId) => {
        try { 
          sendMessage(JSON.stringify({ type: 'subscribe', channelId })); 
        } catch {}
      });
    },
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        handlerRef.current?.(data);
      } catch {}
    },
    onError: () => {
      // react-use-websocket handles reconnection automatically
    },
    shouldReconnect: () => true,
    reconnectAttempts: Infinity,
    reconnectInterval: 3000,
  });

  const subscribe = useCallback((channelId: string) => {
    subscribedRef.current.add(channelId);
    if (readyState === ReadyState.OPEN) {
      try { 
        sendMessage(JSON.stringify({ type: 'subscribe', channelId })); 
      } catch {}
    } else {
      pendingRef.current.push(channelId);
    }
  }, [sendMessage, readyState]);

  const unsubscribe = useCallback((channelId: string) => {
    subscribedRef.current.delete(channelId);
    if (readyState === ReadyState.OPEN) {
      try { 
        sendMessage(JSON.stringify({ type: 'unsubscribe', channelId })); 
      } catch {}
    }
  }, [sendMessage, readyState]);

  return { subscribe, unsubscribe };
}
