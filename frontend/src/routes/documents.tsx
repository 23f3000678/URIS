import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";
import { Upload, FileText, Calendar, Clock, Download, X } from "lucide-react";

export const Route = createFileRoute("/documents")({
  beforeLoad: () => {
    const { token } = useAuthStore.getState();
    if (!token) throw redirect({ to: "/login" });
  },
  component: DocumentsPage,
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

function DocumentsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const documents = useQuery({
    queryKey: ["documents-mine"],
    queryFn: async () => (await api.get("/document/mine")).data,
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error("Please select a file");
      }

      const formData = new FormData();
      formData.append("title", title);
      if (description) formData.append("description", description);
      if (weekStart) formData.append("weekStart", weekStart);
      formData.append("document", file);

      return (await api.post("/document/submit", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })).data;
    },
    onSuccess: () => {
      toast.success("Document submitted successfully");
      setTitle("");
      setDescription("");
      setWeekStart("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["documents-mine"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "Failed to submit document"),
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="DOCUMENTS"
        title="Report Submissions"
        description="Submit your Monday/Thursday reports and view your submission history."
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Submit Document Form */}
        <div className="lg:col-span-1">
          <Card className="border-border/60 bg-card/50 shadow-card backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Submit Report</CardTitle>
              <CardDescription>Upload your weekly report</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-xs">
                    Report Title
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Week of May 26 Report"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-xs">
                    Description (Optional)
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief summary of this report..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weekStart" className="text-xs">
                    Week Start Date (Monday)
                  </Label>
                  <Input
                    id="weekStart"
                    type="date"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Select the Monday of the week this report covers
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Document File</Label>
                  {file ? (
                    <div className="flex items-center justify-between rounded-md border border-border/60 bg-input/40 p-3">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{file.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeFile}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        id="file"
                        type="file"
                        accept=".pdf,.doc,.docx,.txt,.md"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <Label
                        htmlFor="file"
                        className="flex cursor-pointer items-center justify-center rounded-md border border-border/60 bg-input/40 py-8 text-center hover:bg-input/60"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Click to upload
                          </span>
                          <span className="text-xs text-muted-foreground">
                            PDF, DOC, DOCX, TXT, MD
                          </span>
                        </div>
                      </Label>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={submit.isPending || !file}
                  className="w-full"
                >
                  {submit.isPending ? (
                    <>
                      <Upload className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Submit Report
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Document History */}
        <div className="lg:col-span-2">
          <Card className="border-border/60 bg-card/50 shadow-card backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Submission History</CardTitle>
              <CardDescription>Your previously submitted reports</CardDescription>
            </CardHeader>
            <CardContent>
              {documents.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : documents.data?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {documents.data?.map((doc: Document) => (
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
