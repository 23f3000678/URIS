import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";
import { MessageSquare, Users, Plus, Search, MoreVertical, X } from "lucide-react";

export const Route = createFileRoute("/chat")({
  beforeLoad: () => {
    const { token } = useAuthStore.getState();
    if (!token) throw redirect({ to: "/login" });
  },
  component: ChatPage,
});

interface Chat {
  id: string;
  type: 'PRIVATE' | 'GROUP';
  name?: string;
  createdAt: string;
  lastMessage?: {
    content: string;
    senderId: string;
    senderName?: string;
    createdAt: string;
  };
}

function ChatPage() {
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const chats = useQuery({
    queryKey: ["chats"],
    queryFn: async () => (await api.get("/chat/chats")).data,
  });

  const friends = useQuery({
    queryKey: ["friends"],
    queryFn: async () => (await api.get("/chat/friends")).data,
  });

  const handleCreatePrivateChat = async (friendId: string) => {
    try {
      await api.post(`/chat/private/${friendId}`);
      qc.invalidateQueries({ queryKey: ["chats"] });
      toast.success("Chat started");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to create chat");
    }
  };

  const filteredChats = chats.data?.filter((chat: Chat) => {
    if (!searchTerm) return true;
    const chatName = chat.name?.toLowerCase() || '';
    const lastMessage = chat.lastMessage?.content?.toLowerCase() || '';
    return chatName.includes(searchTerm.toLowerCase()) || lastMessage.includes(searchTerm.toLowerCase());
  }) || [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="COMMUNICATION"
        title="Chat"
        description="Private messages and group conversations"
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chat List */}
        <div className="lg:col-span-2">
          <Card className="border-border/60 bg-card/50 shadow-card backdrop-blur-sm">
            <CardHeader className="border-b border-border/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Conversations</CardTitle>
                  <CardDescription>Your active chats</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = "/chat/find"}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Find People
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = "/chat/requests"}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Requests
                    {friends.data?.length ? (
                      <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {friends.data.length}
                      </span>
                    ) : null}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              {chats.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading chats...</p>
              ) : filteredChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No conversations yet</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Start by finding people to chat with
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => window.location.href = "/chat/find"}
                  >
                    Find People
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredChats.map((chat: Chat) => (
                    <div
                      key={chat.id}
                      className="flex items-center justify-between rounded-lg border border-border/30 bg-background/50 p-4 hover:bg-accent/30"
                    >
                      <div className="flex items-center gap-3">
                        {chat.type === 'PRIVATE' ? (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <MessageSquare className="h-5 w-5" />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Users className="h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <h4 className="font-medium text-foreground">
                            {chat.type === 'PRIVATE' ? 'Private Chat' : chat.name}
                          </h4>
                          {chat.lastMessage && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {chat.lastMessage.senderName}: {chat.lastMessage.content}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {chat.lastMessage
                            ? new Date(chat.lastMessage.createdAt).toLocaleDateString()
                            : new Date(chat.createdAt).toLocaleDateString()}
                        </span>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <Card className="border-border/60 bg-card/50 shadow-card backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Start new conversations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Start Private Chat</Label>
                {friends.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading friends...</p>
                ) : friends.data?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No friends yet. Add people to chat.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {friends.data?.map((friend: any) => (
                      <Button
                        key={friend.id}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleCreatePrivateChat(friend.id)}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        {friend.name}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Create Group Chat</Label>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.location.href = "/chat/find"}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Group
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
