import { useEffect, useState, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeToUserChatRooms,
  subscribeToMessages,
  sendMessage,
  markMessagesAsRead,
  type Message,
  type ChatRoom,
} from "@/services/chatService";

export default function RetailerMessagesPage() {
  useRequireRole("retailer", "/login/retailer");
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserChatRooms(user.id, (updatedRooms) => {
      // Filter out support conversations - only show buyer-seller chats
      const buyerSellerRooms = updatedRooms.filter((room) => room.type !== "support");
      setRooms(buyerSellerRooms);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!selectedRoom || !user) return;

    const unsubscribe = subscribeToMessages(selectedRoom.id, (updatedMessages) => {
      setMessages(updatedMessages);
      markMessagesAsRead(selectedRoom.id, user.id);
    });

    return () => unsubscribe();
  }, [selectedRoom, user]);

  useEffect(() => {
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

  const getUnreadCount = (room: ChatRoom) => {
    if (!user) return 0;
    return room.unreadCount[user.id] || 0;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground">Chat with customers and support</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 container mx-auto" style={{ height: 'calc(100vh - 250px)' }}>
          <Card className="lg:col-span-1 flex flex-col">
            <CardHeader>
              <CardTitle>Conversations</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                {rooms.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No conversations yet</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {rooms.map((room) => {
                      const otherName = getOtherParticipant(room);
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

          <Card className="lg:col-span-3 flex flex-col">
            {selectedRoom ? (
              <>
                <CardHeader className="border-b shrink-0">
                  <CardTitle>{getOtherParticipant(selectedRoom) || "Unknown"}</CardTitle>
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
                                className={`max-w-[70%] rounded-lg p-3 ${
                                  isOwn
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary text-secondary-foreground"
                                }`}
                              >
                                {!isOwn && (
                                  <p className="text-xs font-medium mb-1 opacity-80">
                                    {message.senderName}
                                  </p>
                                )}
                                <p className="text-sm">{message.text}</p>
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
    </DashboardLayout>
  );
}