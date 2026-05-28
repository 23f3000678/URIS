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
import { UserPlus, UserX, User } from "lucide-react";

export const Route = createFileRoute("/chat/requests")({
  beforeLoad: () => {
    const { token } = useAuthStore.getState();
    if (!token) throw redirect({ to: "/login" });
  },
  component: ChatRequestsPage,
});

interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
  sender: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

function ChatRequestsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('pending');

  const requests = useQuery({
    queryKey: ["friend-requests"],
    queryFn: async () => (await api.get("/chat/friend-requests")).data,
  });

  const handleAccept = async (id: string) => {
    try {
      await api.patch(`/chat/friend-requests/${id}/accept`);
      qc.invalidateQueries({ queryKey: ["friend-requests"] });
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["chats"] });
      toast.success("Friend request accepted");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to accept request");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.patch(`/chat/friend-requests/${id}/reject`);
      qc.invalidateQueries({ queryKey: ["friend-requests"] });
      toast.success("Friend request rejected");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to reject request");
    }
  };

  const filteredRequests = requests.data?.filter((req: FriendRequest) => {
    if (filter === 'all') return true;
    return req.status === filter;
  }) || [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="COMMUNICATION"
        title="Friend Requests"
        description="Manage your incoming friend requests"
      />

      <div className="mt-6">
        <Card className="border-border/60 bg-card/50 shadow-card backdrop-blur-sm">
          <CardHeader className="border-b border-border/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Requests</CardTitle>
                <CardDescription>Accept or reject friend requests</CardDescription>
              </div>
              <div className="flex gap-2">
                {(['all', 'pending', 'accepted', 'rejected'] as const).map((f) => (
                  <Button
                    key={f}
                    variant={filter === f ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter(f)}
                    className="text-xs"
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {requests.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading requests...</p>
            ) : filteredRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests found</p>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map((req: FriendRequest) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between rounded-lg border border-border/30 bg-background/50 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">{req.sender.name}</h4>
                        <p className="text-xs text-muted-foreground">{req.sender.email}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.status === 'PENDING' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAccept(req.id)}
                          >
                            <UserPlus className="mr-2 h-4 w-4" />
                            Accept
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(req.id)}
                          >
                            <UserX className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </>
                      )}
                      {req.status === 'ACCEPTED' && (
                        <span className="rounded bg-green-500/10 px-2 py-1 text-xs font-medium text-green-500">
                          Friends
                        </span>
                      )}
                      {req.status === 'REJECTED' && (
                        <span className="rounded bg-red-500/10 px-2 py-1 text-xs font-medium text-red-500">
                          Rejected
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
