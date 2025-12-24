import { useEffect, useState, useRef } from "react";
import { AdminDashboardLayout } from "@/components/layout/AdminDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Loader2, HelpCircle } from "lucide-react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { useAuth } from "@/contexts/AuthContext";
import { initializeFirebaseAuth } from "@/lib/firebase";
import {
  subscribeToUserChatRooms,
  subscribeToMessages,
  sendMessage,
  markMessagesAsRead,
  type Message,
  type ChatRoom,
} from "@/services/chatService";

export default function AdminMessagesPage() {
  useRequireRole("admin", "/admin");
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Firebase auth on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initializeFirebaseAuth();
      } catch (error) {
        console.error("Failed to initialize Firebase auth:", error);
      } finally {
        setInitializing(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!user || initializing) return;

    console.log("Subscribing to support chat rooms for admin:", user.id);

    const unsubscribe = subscribeToUserChatRooms(user.id, (updatedRooms) => {
      // Filter to only show support type rooms
      const supportRooms = updatedRooms.filter((room) => room.type === "support");
      console.log(`Received ${supportRooms.length} support rooms`);
      setRooms(supportRooms);
    });

    return () => unsubscribe();
  }, [user, initializing]);

  useEffect(() => {
    if (!selectedRoom || !user) return;

    const unsubscribe = subscribeToMessages(selectedRoom.id, (updatedMessages) => {
      setMessages(updatedMessages);
      // Mark as read
      markMessagesAsRead(selectedRoom.id, user.id);
    });

    return () => unsubscribe();
  }, [selectedRoom, user]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedRoom || !user || sending) return;

    setSending(true);
    try {
      // Use appUserIds to find the other participant (excludes Firebase auth UIDs)
      const appUserIds = selectedRoom.appUserIds || selectedRoom.participants;
      const otherParticipant = appUserIds.find((id) => id !== user.id);
      if (!otherParticipant) {
        console.error("Could not find other participant");
        return;
      }

      await sendMessage(
        selectedRoom.id,
        user.id,
        user.username,
        user.role as "customer" | "retailer" | "admin",
        otherParticipant,
        selectedRoom.participantNames[otherParticipant] || "Unknown",
        messageText.trim(),
        selectedRoom.type
      );
      setMessageText("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const getOtherParticipant = (room: ChatRoom) => {
    if (!user) return null;
    // Use appUserIds to find the other participant (excludes Firebase auth UIDs)
    const appUserIds = room.appUserIds || room.participants;
    const otherId = appUserIds.find((id) => id !== user.id);
    return otherId ? room.participantNames[otherId] : null;
  };

  const getOtherParticipantRole = (room: ChatRoom) => {
    if (!user) return null;
    const appUserIds = room.appUserIds || room.participants;
    const otherId = appUserIds.find((id) => id !== user.id);
    return otherId ? room.participantRoles[otherId] : null;
  };

  const getUnreadCount = (room: ChatRoom) => {
    if (!user) return 0;
    return room.unreadCount[user.id] || 0;
  };

  if (initializing) {
    return (
      <AdminDashboardLayout>
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AdminDashboardLayout>
    );
  }

  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Support Messages</h1>
          <p className="text-muted-foreground">Chat with customers and retailers who need support</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 250px)' }}>
          {/* Chat Rooms List */}
          <Card className="lg:col-span-1 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Support Conversations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                {rooms.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No support conversations yet</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {rooms.map((room) => {
                      const otherName = getOtherParticipant(room);
                      const otherRole = getOtherParticipantRole(room);
                      const unread = getUnreadCount(room);
                      return (
                        <button
                          key={room.id}
                          onClick={() => setSelectedRoom(room)}
                          className={`w-full p-4 text-left hover:bg-secondary/50 transition-colors ${
                            selectedRoom?.id === room.id ? "bg-secondary" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>
                                {otherName?.substring(0, 2).toUpperCase() || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium truncate">{otherName || "Unknown"}</p>
                                {room.lastMessageTime && (
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(room.lastMessageTime).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge 
                                  variant={otherRole === "retailer" ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {otherRole || "User"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {room.lastMessage || "No messages"}
                              </p>
                            </div>
                            {unread > 0 && (
                              <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                                {unread}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat Window */}
          <Card className="lg:col-span-2 flex flex-col">
            {selectedRoom ? (
              <>
                <CardHeader className="border-b shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {getOtherParticipant(selectedRoom) || "Unknown"}
                        <Badge variant="secondary" className="text-xs">
                          {getOtherParticipantRole(selectedRoom) || "User"}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">Support conversation</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0 min-h-0">
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-4 space-y-4">
                      {messages.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                          <p>No messages yet. Start the conversation!</p>
                        </div>
                      ) : (
                        messages.map((message) => {
                          const isOwn = message.senderId === user?.id;
                          return (
                            <div
                              key={message.id}
                              className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[70%] rounded-2xl p-3 shadow-sm ${
                                  isOwn
                                    ? "bg-primary text-primary-foreground rounded-br-sm"
                                    : "bg-secondary text-secondary-foreground rounded-bl-sm"
                                }`}
                              >
                                {!isOwn && (
                                  <p className="text-xs font-medium mb-1 opacity-80">
                                    {message.senderName}
                                  </p>
                                )}
                                <p className="text-sm whitespace-pre-wrap wrap-break-word">{message.text}</p>
                                <p className="text-xs mt-1 opacity-70">
                                  {new Date(message.timestamp).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  <div className="border-t p-4 shrink-0">
                    <div className="flex gap-2">
                      <Input
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder="Type a message..."
                        disabled={sending}
                      />
                      <Button onClick={handleSendMessage} disabled={sending || !messageText.trim()}>
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Select a conversation to start chatting</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AdminDashboardLayout>
  );
}

