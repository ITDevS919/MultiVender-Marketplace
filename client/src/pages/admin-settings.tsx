import { useEffect, useState } from "react";
import { AdminDashboardLayout } from "@/components/layout/AdminDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Settings, AlertCircle, CheckCircle2 } from "lucide-react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function AdminSettingsPage() {
  useRequireRole("admin", "/admin");
  const [commissionRate, setCommissionRate] = useState<number>(0.1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/settings/commission`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load settings");
      }
      setCommissionRate(data.data.commissionRate);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/settings/commission`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ commissionRate }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to save settings");
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminDashboardLayout>
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AdminDashboardLayout>
    );
  }

  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Platform Settings</h1>
          <p className="text-muted-foreground">Manage platform-wide settings and commission rates</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Settings saved successfully!</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Commission Settings
            </CardTitle>
            <CardDescription>
              Set the platform commission rate. This rate applies to all orders.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="commissionRate">Commission Rate</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="commissionRate"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">
                  = {(commissionRate * 100).toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter as a decimal (e.g., 0.10 for 10%, 0.15 for 15%)
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving || commissionRate < 0 || commissionRate > 1}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminDashboardLayout>
  );
}

