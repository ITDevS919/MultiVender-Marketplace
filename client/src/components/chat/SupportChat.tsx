import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, X, Send, Loader2, Minimize2, HelpCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { initializeFirebaseAuth } from "@/lib/firebase";
import {
  getOrCreateChatRoom,
  subscribeToMessages,
  sendMessage,
  markMessagesAsRead,
  type Message,
} from "@/services/chatService";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export function SupportChat() {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [supportAdminId, setSupportAdminId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch support admin ID
  useEffect(() => {
    const fetchSupportAdmin = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/support`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.adminId) {
            setSupportAdminId(data.data.adminId);
          }
        }
      } catch (error) {
        console.error("Failed to fetch support admin:", error);
        // Fallback: use a default support ID if API fails
        setSupportAdminId("support-admin");
      }
    };

    if (isAuthenticated) {
      fetchSupportAdmin();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isOpen && user && !roomId && supportAdminId) {
      initializeChat();
    }
  }, [isOpen, user, supportAdminId]);

  useEffect(() => {
    if (!roomId || !user) return;

    const unsubscribe = subscribeToMessages(roomId, (updatedMessages) => {
      setMessages(updatedMessages);
      markMessagesAsRead(roomId, user.id);
    });

    return () => unsubscribe();
  }, [roomId, user]);

  useEffect(() => {
    if (messagesEndRef.current && isOpen && !isMinimized) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized]);

  const initializeChat = async () => {
    if (!user || !supportAdminId) return;

    setLoading(true);
    setError(null);

    try {
      // Ensure Firebase auth is initialized
      await initializeFirebaseAuth();

      const chatRoomId = await getOrCreateChatRoom(
        user.id,
        supportAdminId,
        user.username,
        "Support Team",
        user.role,
        "admin",
        "support"
      );
      setRoomId(chatRoomId);
    } catch (error: any) {
      console.error("Failed to initialize chat:", error);
      setError(error.message || "Failed to start chat. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !roomId || !user || sending || !supportAdminId) return;

    setSending(true);
    try {
      await sendMessage(
        roomId,
        user.id,
        user.username,
        user.role as "customer" | "retailer" | "admin",
        supportAdminId,
        "Support Team",
        messageText.trim(),
        "support"
      );
      setMessageText("");
    } catch (error: any) {
      console.error("Failed to send message:", error);
      setError(error.message || "Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <>
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 hover:scale-110 transition-transform"
          size="icon"
          aria-label="Open support chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-96 h-[600px] shadow-2xl z-50 flex flex-col border-2 animate-in slide-in-from-bottom-5">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b shrink-0 bg-secondary rounded-t-xl">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Support Chat</CardTitle>
              <Badge variant="secondary" className="text-xs">Live</Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(!isMinimized)}
                aria-label={isMinimized ? "Expand chat" : "Minimize chat"}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  setIsOpen(false);
                  setIsMinimized(false);
                }}
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          {!isMinimized && (
            <>
              <CardContent className="flex-1 flex flex-col p-0 min-h-0 bg-app-primary">
                {error && (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm border-b">
                    {error}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-auto p-0 text-destructive hover:text-destructive"
                      onClick={() => setError(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-4 space-y-4">
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">Connecting to support...</span>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium mb-1">Start a conversation</p>
                        <p className="text-sm">Our support team is here to help!</p>
                      </div>
                    ) : (
                      messages.map((message) => {
                        const isOwn = message.senderId === user?.id;
                        return (
                          <div
                            key={message.id}
                            className={`flex ${isOwn ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${
                                isOwn
                                  ? "bg-primary text-primary-foreground rounded-br-sm"
                                  : "bg-secondary text-secondary-foreground rounded-bl-sm"
                              }`}
                            >
                              {!isOwn && (
                                <p className="text-xs font-semibold mb-1.5 opacity-90">
                                  {message.senderName}
                                </p>
                              )}
                              <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
                                {message.text}
                              </p>
                              <p className="text-xs mt-1.5 opacity-70">
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
                
                <div className="border-t p-4 shrink-0 bg-muted/30">
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
                      placeholder="Type your message..."
                      disabled={sending || loading || !roomId}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleSendMessage} 
                      disabled={sending || !messageText.trim() || loading || !roomId}
                      size="icon"
                      aria-label="Send message"
                    >
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
          )}
        </Card>
      )}
    </>
  );
}


