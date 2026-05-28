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
import { UserPlus, User, Search, X } from "lucide-react";

export const Route = createFileRoute("/chat/find")({
  beforeLoad: () => {
    const { token } = useAuthStore.getState();
    if (!token) throw redirect({ to: "/login" });
  },
  component: ChatFindPage,
});

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

function ChatFindPage() {
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupName, setGroupName] = useState("");

  const users = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data } = await api.get("/admin/users");
      return data;
    },
  });

  const friends = useQuery({
    queryKey: ["friends"],
    queryFn: async () => (await api.get("/chat/friends")).data,
  });

  const friendRequests = useQuery({
    queryKey: ["friend-requests"],
    queryFn: async () => (await api.get("/chat/friend-requests")).data,
  });

  const handleSendFriendRequest = async (userId: string) => {
    try {
      await api.post("/chat/friend-requests", { receiverId: userId });
      qc.invalidateQueries({ queryKey: ["friend-requests"] });
      toast.success("Friend request sent");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to send request");
    }
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length < 2) {
      toast.error("Group chat must have at least 2 participants");
      return;
    }

    try {
      await api.post("/chat/group", {
        name: groupName || "New Group",
        participantIds: selectedUsers,
      });
      toast.success("Group chat created");
      window.location.href = "/chat";
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to create group");
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const filteredUsers = users.data?.filter((user: User) => {
    if (!searchTerm) return true;
    return (
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }) || [];

  const isFriend = (userId: string) => {
    return friends.data?.some((f: any) => f.id === userId);
  };

  const hasPendingRequest = (userId: string) => {
    return friendRequests.data?.some((r: FriendRequest) =>
      (r.senderId === userId && r.receiverId === users.data?.find(u => u.id === userId)?.id) ||
      (r.receiverId === userId && r.senderId === users.data?.find(u => u.id === userId)?.id)
    );
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="COMMUNICATION"
        title="Find People"
        description="Search and connect with other users"
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Search and Filter */}
        <div className="lg:col-span-1">
          <Card className="border-border/60 bg-card/50 shadow-card backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Search Users</CardTitle>
              <CardDescription>Find interns, leads, and admins</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-md border border-border bg-background pl-10 pr-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Mode</Label>
                <div className="flex gap-2">
                  <Button
                    variant={isGroupMode ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setIsGroupMode(false)}
                  >
                    Private
                  </Button>
                  <Button
                    variant={isGroupMode ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setIsGroupMode(true)}
                  >
                    Group
                  </Button>
                </div>
              </div>

              {isGroupMode && (
                <div className="space-y-2">
                  <Label className="text-xs">Group Name</Label>
                  <input
                    type="text"
                    placeholder="Enter group name..."
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              )}

              {isGroupMode && selectedUsers.length > 0 && (
                <div className="rounded-lg border border-border/30 bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Selected ({selectedUsers.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map(userId => {
                      const user = users.data?.find((u: User) => u.id === userId);
                      return (
                        <span
                          key={userId}
                          className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs text-primary"
                        >
                          {user?.name}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => toggleUserSelection(userId)}
                          />
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {isGroupMode && (
                <Button
                  className="w-full"
                  onClick={handleCreateGroup}
                  disabled={selectedUsers.length < 2}
                >
                  Create Group Chat
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Users List */}
        <div className="lg:col-span-2">
          <Card className="border-border/60 bg-card/50 shadow-card backdrop-blur-sm">
            <CardHeader className="border-b border-border/30">
              <CardTitle className="text-lg">Users</CardTitle>
              <CardDescription>
                {filteredUsers.length} user(s) found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {users.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading users...</p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No users found</p>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map((user: User) => {
                    const isSelf = user.id === useAuthStore.getState().user?.id;
                    const isAlreadyFriend = isFriend(user.id);
                    const hasRequest = hasPendingRequest(user.id);

                    if (isSelf) return null;

                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between rounded-lg border border-border/30 bg-background/50 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <User className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-medium text-foreground">{user.name}</h4>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">
                              {user.role.replace('_', ' ')}
                            </p>
                          </div>
                        </div>
                        <div>
                          {isAlreadyFriend ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Navigate to chat with this user
                                window.location.href = "/chat";
                              }}
                            >
                              Chat
                            </Button>
                          ) : hasRequest ? (
                            <span className="rounded bg-yellow-500/10 px-2 py-1 text-xs font-medium text-yellow-500">
                              Request Sent
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendFriendRequest(user.id)}
                            >
                              <UserPlus className="mr-2 h-4 w-4" />
                              Add
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
