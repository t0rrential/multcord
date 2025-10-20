import { useState } from "react";

import { ActionIcon } from "@mantine/core";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Menu, Sun, Moon, Info } from "lucide-react";
import ChannelPicker from "./ChannelPicker";

// type ToolbarProps = {
//   onSettings?: () => void;
//   onInfo?: () => void;
//   onAddChannels?: () => void;
// }

export default function Toolbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isChannelPickerOpen, setIsChannelPickerOpen] = useState(false);

  const handleChannelPick = (channelId: string, channelName: string) => {
    console.log(`Selected channel: ${channelName} (${channelId})`);
    // Here you can add logic to subscribe to the channel or perform other actions
  };

  const toolbarItems = [
    { icon: Plus, label: "Add", onClick: () => setIsChannelPickerOpen(true) },
    { icon: Menu, label: "Menu", onClick: () => console.log("Menu clicked") },
    { icon: isDarkMode ? Sun : Moon, label: "Theme", onClick: () => setIsDarkMode(!isDarkMode) },
    { icon: Info, label: "Info", onClick: () => console.log("Info clicked") },
  ];

  return (
    <div className="relative flex items-center">
      {/* Main toggle button */}
      <ActionIcon
        size='xl'
        radius='xl'
        variant='transparent'
        onClick={() => setIsOpen(!isOpen)}
        className="h-12 w-12 rounded-full ring-1 ring-black/10 bg-white/10 backdrop-blur-xl z-20"
      >
        <motion.div 
          key={isOpen ? "x" : "plus"}
          initial={{ rotate: isOpen ? -45 : 45, scale: 0.8}}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: isOpen ? 45 : -45, opacity: 1, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
        >
          {isOpen ? <X className="text-black" /> : <Plus className="text-black" />}
        </motion.div>
      </ActionIcon>

      {/* Expandable toolbar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -200, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -200, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute left-full ml-2 top-0 flex items-center gap-2 bg-white/10 backdrop-blur-xl rounded-full px-4 py-2 ring-1 ring-black/10"
          >
            {toolbarItems.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ 
                  delay: index * 0.1,
                  type: "spring", 
                  stiffness: 400, 
                  damping: 25 
                }}
              >
                <ActionIcon
                  size="md"
                  radius="xl"
                  variant="transparent"
                  onClick={item.onClick}
                  className="h-8 w-8 rounded-full hover:bg-white/20 transition-colors"
                  title={item.label}
                >
                  <item.icon className="h-4 w-4 text-black" />
                </ActionIcon>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Channel Picker Modal */}
      <ChannelPicker
        opened={isChannelPickerOpen}
        onClose={() => setIsChannelPickerOpen(false)}
        onPickChannel={handleChannelPick}
      />
    </div>
  )
}