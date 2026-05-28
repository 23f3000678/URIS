import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Starfield } from "@/components/Starfield";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Mail, Briefcase, User } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email, role, leadEmail });
      setSuccess(true);
      toast.success("Reset link sent to your email");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-hero relative flex min-h-screen items-center justify-center overflow-hidden px-4">
        <div className="absolute inset-0">
          <Starfield density={90} />
        </div>

        <div className="relative z-10 w-full max-w-md">
          <div className="rounded-lg border border-border/60 bg-card/50 p-8 text-center shadow-card backdrop-blur-md">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <Mail className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="font-display text-3xl tracking-display text-foreground">Check Your Email</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              We've sent a password reset link to <strong className="text-foreground">{email}</strong>.
              {leadEmail && leadEmail !== email && (
                <span className="block mt-2">
                  A copy has also been sent to your lead: <strong className="text-foreground">{leadEmail}</strong>
                </span>
              )}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Please check your inbox and click the link to reset your password.
            </p>
            <div className="mt-8">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSuccess(false);
                  setEmail("");
                  setRole("");
                  setLeadEmail("");
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Forgot Password
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-hero relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="absolute inset-0">
        <Starfield density={90} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-10 text-center">
          <h1 className="font-display text-5xl tracking-display text-gradient sm:text-6xl">
            STEMONEF
          </h1>
          <p className="mt-2 text-xs tracking-display text-gold">
            INTELLIGENCE SYSTEM
          </p>
          <div className="divider-gold mx-auto mt-6 w-32" />
        </div>

        <div className="rounded-lg border border-border/60 bg-card/50 p-8 shadow-card backdrop-blur-md">
          <h2 className="font-display text-2xl tracking-display text-foreground">Forgot Password</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your details and we'll send you a link to reset your password.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs tracking-display text-gold/80">
                EMAIL ADDRESS
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 border-border/60 bg-input/60 text-foreground"
                  placeholder="your.email@company.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-xs tracking-display text-gold/80">
                YOUR ROLE
              </Label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="pl-10 border-border/60 bg-input/60 text-foreground">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical_intern">Technical Intern</SelectItem>
                    <SelectItem value="operations_intern">Operations Intern</SelectItem>
                    <SelectItem value="research_intern">Research Intern</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="leadEmail" className="text-xs tracking-display text-gold/80">
                LEAD EMAIL (Optional)
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="leadEmail"
                  type="email"
                  autoComplete="email"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  className="pl-10 border-border/60 bg-input/60 text-foreground"
                  placeholder="lead.email@company.com (optional)"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                If provided, the lead will also receive the reset link.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary font-medium tracking-wide text-primary-foreground hover:bg-primary/90 hover:shadow-glow"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Remember your password?{" "}
              <a href="/login" className="text-primary hover:underline">
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
