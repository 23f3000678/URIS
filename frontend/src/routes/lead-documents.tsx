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
import { FileText, Download, User, Mail, Briefcase, Calendar, Clock } from "lucide-react";

export const Route = createFileRoute("/lead-documents")({
  beforeLoad: () => {
    const { token, user } = useAuthStore.getState();
    if (!token) throw redirect({ to: "/login" });
    if (user && user.role !== "admin" && user.role !== "lead")
      throw redirect({ to: "/dashboard" });
  },
  component: LeadDocumentsPage,
});

interface Document {
  id: number;
  title: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  weekStart: string | null;
  submittedAt: string;
  intern: {
    id: number;
    user: {
      name: string;
      email: string;
      role: string;
    };
  };
}

interface Intern {
  id: number;
  name: string;
  email: string;
  role: string;
  tasks: Array<{
    id: number;
    title: string;
    status: string;
    complexity: number;
    skills: string[];
    progressPct: number;
    deadline: string | null;
  }>;
}

function LeadDocumentsPage() {
  const [selectedInternId, setSelectedInternId] = useState<string>("");
  const [interns, setInterns] = useState<Intern[]>([]);

  const documentsQuery = useQuery({
    queryKey: ["lead-documents", selectedInternId],
    queryFn: async () => {
      if (!selectedInternId) return null;
      const { data } = await api.get(`/document/lead/${selectedInternId}`);
      return data;
    },
    enabled: !!selectedInternId,
  });

  const internsQuery = useQuery({
    queryKey: ["interns-list"],
    queryFn: async () => {
      const { data } = await api.get("/admin/overview");
      return data.interns || [];
    },
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (internsQuery.isLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" />
            <p className="text-sm text-muted-foreground">Loading interns...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const handleInternSelect = (internId: string) => {
    setSelectedInternId(internId);
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="COMMAND"
        title="Intern Documents"
        description="View and download reports submitted by your interns."
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Intern Selector */}
        <div className="lg:col-span-1">
          <Card className="border-border/60 bg-card/50 shadow-card backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Select Intern</CardTitle>
              <CardDescription>Choose an intern to view their documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="internSelect" className="text-xs">
                  Intern Name
                </Label>
                <select
                  id="internSelect"
                  value={selectedInternId}
                  onChange={(e) => handleInternSelect(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select an intern...</option>
                  {internsQuery.data?.map((intern: any) => (
                    <option key={intern.id} value={intern.id}>
                      {intern.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedInternId && documentsQuery.data && (
                <div className="mt-6 space-y-4">
                  <div className="rounded-lg border border-border/30 bg-background/50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="h-4 w-4 text-primary" />
                      <h4 className="font-medium text-foreground">Intern Details</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-foreground">{documentsQuery.data.intern.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{documentsQuery.data.intern.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{documentsQuery.data.intern.role.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  {documentsQuery.data.intern.tasks.length > 0 && (
                    <div className="rounded-lg border border-border/30 bg-background/50 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Briefcase className="h-4 w-4 text-primary" />
                        <h4 className="font-medium text-foreground">Active Tasks</h4>
                      </div>
                      <div className="space-y-2">
                        {documentsQuery.data.intern.tasks.map((task: any) => (
                          <div
                            key={task.id}
                            className="rounded border border-border/30 bg-background/50 p-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{task.title}</span>
                              <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                                task.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'
                              }`}>
                                {task.status.toUpperCase()}
                              </span>
                            </div>
                            {task.deadline && (
                              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>Deadline: {new Date(task.deadline).toLocaleDateString()}</span>
                              </div>
                            )}
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Complexity: {task.complexity}</span>
                              {task.skills.length > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{task.skills.join(", ")}</span>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Documents List */}
        <div className="lg:col-span-2">
          <Card className="border-border/60 bg-card/50 shadow-card backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Submitted Documents</CardTitle>
              <CardDescription>Reports submitted by the selected intern</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedInternId ? (
                <p className="text-sm text-muted-foreground">Select an intern to view their documents.</p>
              ) : documentsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading documents...</p>
              ) : documentsQuery.data?.documents?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {documentsQuery.data?.documents?.map((doc: Document) => (
                    <div
                      key={doc.id}
                      className="flex items-start justify-between rounded-lg border border-border/30 bg-background/50 p-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <h4 className="font-medium text-foreground">{doc.title}</h4>
                          {doc.weekStart && (
                            <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-gold/70">
                              Week of {new Date(doc.weekStart).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {doc.description && (
                          <p className="text-sm text-muted-foreground mb-2">{doc.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(doc.submittedAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {formatFileSize(doc.fileSize)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-md border border-border/60 bg-background px-3 py-2 text-xs font-medium hover:bg-accent"
                        >
                          <Download className="mr-1 h-3 w-3" />
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
