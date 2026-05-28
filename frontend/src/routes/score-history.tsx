import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/score-history")({
  beforeLoad: () => {
    const { token, user } = useAuthStore.getState();
    if (!token) throw redirect({ to: "/login" });
    if (user && user.role !== "admin" && user.role !== "lead")
      throw redirect({ to: "/dashboard" });
  },
  component: ScoreHistoryPage,
});

interface ScoreHistoryEntry {
  id: number;
  internId: number;
  internName: string;
  internEmail: string;
  scoreType: string;
  oldScore: number;
  newScore: number;
  scoreChange: number;
  reason: string;
  createdAt: string;
}

function ScoreHistoryPage() {
  const [internFilter, setInternFilter] = useState<string>("");
  const [scoreTypeFilter, setScoreTypeFilter] = useState<string>("");

  const history = useQuery({
    queryKey: ["score-history", internFilter, scoreTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (internFilter) params.append("internId", internFilter);
      if (scoreTypeFilter) params.append("scoreType", scoreTypeFilter);
      
      const { data } = await api.get(`/score/history?${params.toString()}`);
      return data;
    },
  });

  const internsQuery = useQuery({
    queryKey: ["interns-list"],
    queryFn: async () => {
      const { data } = await api.get("/admin/overview");
      return data.interns || [];
    },
  });

  const interns = internsQuery.data || [];

  if (history.isLoading || internsQuery.isLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" />
            <p className="text-sm text-muted-foreground">Loading score history...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const filteredHistory = history.data?.filter((entry: ScoreHistoryEntry) => {
    if (internFilter && !entry.internName?.toLowerCase().includes(internFilter.toLowerCase())) {
      return false;
    }
    if (scoreTypeFilter && !entry.scoreType?.toLowerCase().includes(scoreTypeFilter.toLowerCase())) {
      return false;
    }
    return true;
  }) || [];

  const scoreTypes = [...new Set(filteredHistory.map((e: ScoreHistoryEntry) => e.scoreType))];

  return (
    <AppShell>
      <PageHeader
        eyebrow="COMMAND"
        title="Score History"
        description="Track all score changes with reasons for each intern."
      />

      {/* Filters */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 bg-card/50 shadow-card backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardDescription>Filter by Intern</CardDescription>
          </CardHeader>
          <CardContent>
            <select
              value={internFilter}
              onChange={(e) => setInternFilter(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">All Interns</option>
              {interns.map((intern: any) => (
                <option key={intern.id} value={intern.name}>
                  {intern.name}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50 shadow-card backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardDescription>Filter by Score Type</CardDescription>
          </CardHeader>
          <CardContent>
            <select
              value={scoreTypeFilter}
              onChange={(e) => setScoreTypeFilter(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">All Score Types</option>
              {scoreTypes.map((type: string) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      </div>

      {/* Score History Table */}
      <section className="mt-6 rounded-lg border border-border/60 bg-card/50 p-6 shadow-card backdrop-blur-sm">
        <h3 className="mb-4 text-xs tracking-display text-gold/80">SCORE CHANGE LOG</h3>
        <div className="divider-gold mb-4 w-16" />

        {filteredHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No score history found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-[10px] tracking-display text-gold/70">
                  <th className="py-3 font-normal">INTERNSHIP</th>
                  <th className="py-3 font-normal">SCORE TYPE</th>
                  <th className="py-3 font-normal">CHANGE</th>
                  <th className="py-3 font-normal">REASON</th>
                  <th className="py-3 font-normal">TIMESTAMP</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((entry: ScoreHistoryEntry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-border/30 transition-colors hover:bg-accent/20"
                  >
                    <td className="py-3">
                      <div className="font-medium text-foreground">{entry.internName}</div>
                      <div className="text-xs text-muted-foreground">{entry.internEmail}</div>
                    </td>
                    <td className="py-3">
                      <span className="rounded bg-muted px-2 py-1 text-[10px] font-medium tracking-display text-gold/70">
                        {entry.scoreType}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold ${entry.scoreChange > 0 ? "text-green-500" : entry.scoreChange < 0 ? "text-red-500" : "text-foreground"}`}>
                          {entry.scoreChange > 0 ? "+" : ""}{entry.scoreChange.toFixed(1)}
                        </span>
                        <span className="text-muted-foreground">
                          ({entry.oldScore.toFixed(1)} → {entry.newScore.toFixed(1)})
                        </span>
                      </div>
                    </td>
                    <td className="py-3 max-w-xs">
                      <div className="truncate text-foreground" title={entry.reason}>
                        {entry.reason}
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
