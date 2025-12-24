import { Link, useLocation } from "wouter";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ASSETS } from "@/lib/product";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Shield, Info } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function LoginAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [setupData, setSetupData] = useState({ username: "", email: "", password: "" });
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (user?.role === "admin") {
      setLocation("/admin/dashboard");
    }
  }, [user, authLoading, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Login failed");
      }

      // Reload to update auth state
      window.location.href = "/admin/dashboard";
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSetupAdmin = async () => {
    setSetupError("");
    setSetupLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/setup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(setupData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create admin");
      }

      // Close dialog and show success
      setShowSetupDialog(false);
      setError("");
      alert("Admin user created successfully! You can now log in.");
      // Pre-fill login form
      setUsername(setupData.username);
      setPassword(setupData.password);
    } catch (err: any) {
      setSetupError(err.message || "Failed to create admin user");
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/">
            <img
              src={ASSETS.logo}
              alt="Localito Logo"
              className="h-14 w-auto object-contain cursor-pointer"
            />
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-center">Admin Login</h1>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Sign in to access the admin panel
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <div className="text-sm text-center text-muted-foreground">
              Not an admin?{" "}
              <Link href="/login/retailer" className="text-primary hover:underline font-medium">
                Retailer login
              </Link>
              {" or "}
              <Link href="/login/customer" className="text-primary hover:underline font-medium">
                Customer login
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Setup Admin Dialog */}
      <AlertDialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Admin Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will create the first admin user. Make sure to use a strong password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            {setupError && (
              <Alert variant="destructive">
                <AlertDescription>{setupError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="setup-username">Username</Label>
              <Input
                id="setup-username"
                value={setupData.username}
                onChange={(e) => setSetupData({ ...setupData, username: e.target.value })}
                placeholder="Enter username"
                required
                disabled={setupLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-email">Email</Label>
              <Input
                id="setup-email"
                type="email"
                value={setupData.email}
                onChange={(e) => setSetupData({ ...setupData, email: e.target.value })}
                placeholder="Enter email"
                required
                disabled={setupLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-password">Password</Label>
              <Input
                id="setup-password"
                type="password"
                value={setupData.password}
                onChange={(e) => setSetupData({ ...setupData, password: e.target.value })}
                placeholder="Enter password (min 6 characters)"
                required
                minLength={6}
                disabled={setupLoading}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={setupLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSetupAdmin}
              disabled={setupLoading || !setupData.username || !setupData.email || !setupData.password}
            >
              {setupLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Admin"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

