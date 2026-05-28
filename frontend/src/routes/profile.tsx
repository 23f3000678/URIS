import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";
import { Loader2, Link as LinkIcon, Mail, Phone, Edit, Save, X } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

interface ProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  bio?: string;
  profilePic?: string;
  contactNumber?: string;
  linkedinUrl?: string;
  gdocUrl?: string;
  googleConnected?: boolean;
}

function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [googleConnecting, setGoogleConnecting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    bio: "",
    contactNumber: "",
    linkedinUrl: "",
    gdocUrl: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get("/profile/me");
      const { data: googleStatus } = await api.get("/google/status");
      
      setProfile({
        id: user?.id || "",
        name: user?.name || "",
        email: user?.email || "",
        role: user?.role || "",
        bio: data.bio || "",
        profilePic: data.profilePic || "",
        contactNumber: data.contactNumber || "",
        linkedinUrl: data.linkedinUrl || "",
        gdocUrl: data.gdocUrl || "",
        googleConnected: googleStatus.connected || false,
      });
      
      setFormData({
        bio: data.bio || "",
        contactNumber: data.contactNumber || "",
        linkedinUrl: data.linkedinUrl || "",
        gdocUrl: data.gdocUrl || "",
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleConnect = async () => {
    try {
      setGoogleConnecting(true);
      const { token } = useAuthStore.getState();
      if (!token) {
        toast.error("Not authenticated");
        return;
      }
      window.location.href = `${import.meta.env.VITE_API_BASE || "http://localhost:5000"}/auth/google?token=${token}`;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to connect Google");
      setGoogleConnecting(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    try {
      await api.delete("/google");
      toast.success("Google account disconnected");
      fetchProfile();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to disconnect Google");
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.patch("/profile/me", formData);
      toast.success("Profile updated successfully");
      setEditing(false);
      fetchProfile();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" />
            <p className="text-sm text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!profile) return null;

  return (
    <AppShell>
      <PageHeader
        eyebrow={`AGENT · ${profile.name}`}
        title="Personal Profile"
        description="Manage your account, connect services, and update your information."
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile Header Card */}
        <div className="lg:col-span-2">
          <Card className="border-border/60 bg-card/50 shadow-card backdrop-blur-sm">
            <CardHeader className="border-b border-border/30">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{profile.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {profile.email} • {profile.role.toUpperCase()}
                  </CardDescription>
                </div>
                {profile.profilePic && (
                  <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-border/30">
                    <img
                      src={profile.profilePic}
                      alt={profile.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Google Connection Status */}
                <div className="flex items-center justify-between rounded-lg border border-border/30 bg-background/50 p-4">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-full p-2 ${profile.googleConnected ? "bg-green-500/10 text-green-500" : "bg-gray-500/10 text-gray-500"}`}>
                      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Google Account</p>
                      <p className="text-xs text-muted-foreground">
                        {profile.googleConnected
                          ? "Connected • Work logs & calendar synced"
                          : "Not connected • Connect for automation"}
                      </p>
                    </div>
                  </div>
                  {profile.googleConnected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGoogleDisconnect}
                      className="text-xs"
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGoogleConnect}
                      disabled={googleConnecting}
                      className="text-xs"
                    >
                      {googleConnecting ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Google className="mr-2 h-3 w-3" />
                          Connect
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Contact Information */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{profile.email}</span>
                  </div>
                  {profile.contactNumber && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{profile.contactNumber}</span>
                    </div>
                  )}
                  {profile.linkedinUrl && (
                    <a
                      href={profile.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-sm text-primary hover:underline"
                    >
                      <LinkIcon className="h-4 w-4" />
                      <span className="text-foreground truncate">{profile.linkedinUrl}</span>
                    </a>
                  )}
                </div>

                {/* Bio */}
                {profile.bio && (
                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-sm text-foreground">{profile.bio}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Edit Section */}
        <div className="lg:col-span-1">
          <Card className="border-border/60 bg-card/50 shadow-card backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Edit Profile</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent>
              {!editing ? (
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setEditing(true)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Information
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate({ to: "/dashboard" })}
                  >
                    Back to Dashboard
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bio" className="text-xs">
                      Bio
                    </Label>
                    <Input
                      id="bio"
                      value={formData.bio}
                      onChange={(e) => handleInputChange("bio", e.target.value)}
                      placeholder="Enter your bio"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactNumber" className="text-xs">
                      Contact Number
                    </Label>
                    <Input
                      id="contactNumber"
                      value={formData.contactNumber}
                      onChange={(e) => handleInputChange("contactNumber", e.target.value)}
                      placeholder="Enter contact number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedinUrl" className="text-xs">
                      LinkedIn URL
                    </Label>
                    <Input
                      id="linkedinUrl"
                      value={formData.linkedinUrl}
                      onChange={(e) => handleInputChange("linkedinUrl", e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gdocUrl" className="text-xs">
                      Google Docs URL
                    </Label>
                    <Input
                      id="gdocUrl"
                      value={formData.gdocUrl}
                      onChange={(e) => handleInputChange("gdocUrl", e.target.value)}
                      placeholder="https://docs.google.com/document/d/..."
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setEditing(false);
                        setFormData({
                          bio: profile.bio || "",
                          contactNumber: profile.contactNumber || "",
                          linkedinUrl: profile.linkedinUrl || "",
                          gdocUrl: profile.gdocUrl || "",
                        });
                      }}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
