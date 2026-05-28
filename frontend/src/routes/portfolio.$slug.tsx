import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { api } from "@/lib/api";

export const Route = createFileRoute("/portfolio/$slug")({
  component: PortfolioPage,
});

function PortfolioPage() {
  const { slug } = Route.useParams();

  const portfolio = useQuery({
    queryKey: ["portfolio", slug],
    queryFn: async () => (await api.get(`/portfolio/${slug}`)).data,
  });

  if (portfolio.isLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" />
            <p className="text-sm text-muted-foreground">Loading portfolio...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!portfolio.data) {
    return (
      <AppShell>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">Portfolio not found</h2>
            <p className="mt-2 text-muted-foreground">The requested portfolio does not exist.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const { name, email, role, bio, profilePic, contactNumber, linkedinUrl, skills, completedTasks, portfolioUrl } = portfolio.data;

  return (
    <AppShell>
      <PageHeader
        eyebrow={`INTERNSHIP PORTFOLIO`}
        title={name || "Unknown Intern"}
        description={role || "Intern"}
      />

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Profile Section */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-border/60 bg-card/50 p-6 shadow-card backdrop-blur-sm">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 h-24 w-24 overflow-hidden rounded-full border-4 border-border/30 bg-muted">
                {profilePic ? (
                  <img
                    src={profilePic}
                    alt={name || "Profile"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted/50">
                    <span className="text-4xl font-display text-gold/50">
                      {name?.[0]?.toUpperCase() || "?"}
                    </span>
                  </div>
                )}
              </div>
              <h2 className="font-display text-2xl text-foreground">{name}</h2>
              <p className="text-sm text-muted-foreground">{email}</p>
              <p className="mt-2 text-xs tracking-display text-gold/70">{role.toUpperCase()}</p>
            </div>

            {bio && (
              <div className="mt-6">
                <h3 className="text-xs tracking-display text-gold/80">BIO</h3>
                <div className="divider-gold mb-4 w-16" />
                <p className="text-sm text-muted-foreground">{bio}</p>
              </div>
            )}

            {(contactNumber || linkedinUrl) && (
              <div className="mt-6 space-y-3">
                {contactNumber && (
                  <div className="flex items-center gap-2 text-sm">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                    <span className="text-sm text-muted-foreground">{contactNumber}</span>
                  </div>
                )}
                {linkedinUrl && (
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                    </svg>
                    <span className="text-sm text-muted-foreground truncate">{linkedinUrl}</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Skills and Tasks Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Skills */}
          {skills && skills.length > 0 && (
            <div className="rounded-lg border border-border/60 bg-card/50 p-6 shadow-card backdrop-blur-sm">
              <h3 className="text-xs tracking-display text-gold/80">SKILLS</h3>
              <div className="divider-gold mb-4 w-16" />
              <div className="flex flex-wrap gap-2">
                {skills.map((skill: string, idx: number) => (
                  <span
                    key={idx}
                    className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Completed Tasks */}
          {completedTasks && completedTasks.length > 0 && (
            <div className="rounded-lg border border-border/60 bg-card/50 p-6 shadow-card backdrop-blur-sm">
              <h3 className="text-xs tracking-display text-gold/80">COMPLETED TASKS</h3>
              <div className="divider-gold mb-4 w-16" />
              <div className="space-y-3">
                {completedTasks.map((task: any) => (
                  <div
                    key={task.id}
                    className="rounded border border-border/30 bg-background/50 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium text-foreground">{task.title}</h4>
                      <span className="rounded bg-muted px-2 py-1 text-[10px] font-medium tracking-display text-gold/70">
                        {task.complexity?.toUpperCase() || "N/A"}
                      </span>
                    </div>
                    {task.skills && task.skills.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {task.skills.map((s: string, i: number) => (
                          <span
                            key={i}
                            className="text-[10px] text-muted-foreground"
                          >
                            • {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {task.deadline && (
                      <p className="mt-2 text-xs text-muted-foreground">
                    Deadline: {new Date(task.deadline).toLocaleDateString()}
                  </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
