import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Loader } from "@mantine/core";
import "./ChannelPicker.css";

type ServerSummary = {
  id: string;
  name: string;
  members: number;
  icon?: string;
};

type ChannelSummary = {
  id: string;
  name: string;
};

type ChannelPickerProps = {
  opened: boolean;
  onClose: () => void;
  onPickChannel: (channelId: string, channelName: string) => void;
};

export default function ChannelPicker({ opened, onClose, onPickChannel }: ChannelPickerProps) {
  const [loading, setLoading] = useState(false);
  const [servers, setServers] = useState<ServerSummary[]>([]);
  const [stage, setStage] = useState<"servers" | "channels">("servers");
  const [selectedServer, setSelectedServer] = useState<ServerSummary | null>(null);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [serverQuery, setServerQuery] = useState("");
  const [channelQuery, setChannelQuery] = useState("");

  useEffect(() => {
    if (!opened) return;
    setStage("servers");
    setSelectedServer(null);
    setChannels([]);
    setLoading(true);
    
    // Fetch servers from your Discord API
    fetch('/api/discord/servers')
      .then((r) => {
        console.log('Server response status:', r.status);
        console.log('Response headers:', Object.fromEntries(r.headers.entries()));
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        }
        return r.text().then(text => {
          console.log('Raw response:', text.substring(0, 200));
          try {
            return JSON.parse(text);
          } catch (e) {
            throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
          }
        });
      })
      .then((data: ServerSummary[]) => {
        console.log('Received servers:', data);
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
        setServers(sorted);
      })
      .catch((error) => {
        console.error('Failed to fetch servers:', error);
        setServers([]);
      })
      .finally(() => setLoading(false));
  }, [opened]);

  async function loadChannels(server: ServerSummary) {
    setLoading(true);
    try {
      console.log(`Loading channels for server: ${server.name} (${server.id})`);
      // Fetch channels for the selected server
      const res = await fetch(`/api/discord/servers/${server.id}`);
      console.log(`Response status: ${res.status}`);
      
      if (!res.ok) {
        console.error(`Failed to fetch channels: ${res.status} ${res.statusText}`);
        setChannels([]);
      } else {
        const data = await res.json();
        console.log('Received channel data:', data);
        const channelList = Array.isArray(data) ? data : [];
        console.log(`Found ${channelList.length} channels`);
        setChannels(channelList);
      }
      setStage("channels");
      setSelectedServer(server);
      setChannelQuery("");
    } catch (error) {
      console.error('Failed to load channels:', error);
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }

  function onPick(channelId: string, channelName: string) {
    onPickChannel(channelId, channelName);
    onClose();
  }

  const filteredServers = useMemo(() => {
    if (!serverQuery.trim()) return servers;
    const q = serverQuery.toLowerCase();
    return servers.filter((s) => s.name.toLowerCase().includes(q));
  }, [servers, serverQuery]);

  const filteredChannels = useMemo(() => {
    if (!channelQuery.trim()) return channels;
    const q = channelQuery.toLowerCase();
    return channels.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, channelQuery]);

  return (
    <AnimatePresence>
      {opened && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-[90vw] max-w-2xl rounded-2xl bg-white/10 backdrop-blur-xl p-4 shadow-2xl ring-1 ring-black/10"
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            exit={{ y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.1 }}
          >
            {stage === "servers" && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Select a server</h3>
                <input
                  autoFocus
                  type="text"
                  value={serverQuery}
                  onChange={(e) => setServerQuery(e.currentTarget.value)}
                  placeholder="Search servers..."
                  className="mb-3 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-white/30"
                />
                {loading ? (
                  <div className="py-8 flex justify-center"><Loader size="sm" /></div>
                ) : (
                  <div className="max-h-80 overflow-y-auto pr-1 channel-picker-scroll">
                    <ul className="space-y-2">
                      {filteredServers.map((s) => (
                        <li key={s.id}>
                          <button
                            className="w-full flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/10 transition"
                            onClick={() => loadChannels(s)}
                          >
                            <Avatar 
                              src={s.icon ? `https://cdn.discordapp.com/icons/${s.id}/${s.icon}.png?size=64` : undefined}
                              alt={s.name} 
                              size={28} 
                              radius="xl"
                              color="blue"
                            >
                              {s.name.charAt(0).toUpperCase()}
                            </Avatar>
                            <span className="flex-1 text-left text-white">{s.name}</span>
                            <span className="text-xs text-white/90">{s.members} members</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {stage === "channels" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Select a channel</h3>
                    {selectedServer && (
                      <p className="text-sm text-white/70">from {selectedServer.name}</p>
                    )}
                  </div>
                  <button className="text-sm text-white/70 hover:text-white hover:underline" onClick={() => setStage("servers")}>Back</button>
                </div>
                <input
                  autoFocus
                  type="text"
                  value={channelQuery}
                  onChange={(e) => setChannelQuery(e.currentTarget.value)}
                  placeholder="Search channels..."
                  className="mb-3 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-white/60 outline-none focus:ring-2 focus:ring-white/30"
                />
                {loading ? (
                  <div className="py-8 flex justify-center"><Loader size="sm" /></div>
                ) : channels.length === 0 ? (
                  <div className="text-sm text-white/70">No channels available.</div>
                ) : (
                  <div className="max-h-80 overflow-y-auto pr-1 channel-picker-scroll">
                    <ul className="space-y-2">
                      {filteredChannels.map((c) => (
                        <li key={c.id}>
                          <button
                            className="w-full flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/10 transition text-left"
                            onClick={() => onPick(c.id, c.name)}
                          >
                            <span className="text-white"># {c.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
