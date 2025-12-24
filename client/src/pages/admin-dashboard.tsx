import { useEffect, useState } from "react";
import { AdminDashboardLayout } from "@/components/layout/AdminDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Package, Users, AlertCircle, CheckCircle2 } from "lucide-react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { Link } from "wouter";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

interface PendingRetailer {
  id: string;
  business_name: string;
  email: string;
  username: string;
  created_at: string;
}

interface PendingProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  retailerid: string;
  createdAt?: string;
}

export default function AdminDashboard() {
  useRequireRole("admin", "/admin");
  const [pendingRetailers, setPendingRetailers] = useState<PendingRetailer[]>([]);
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [retRes, prodRes] = await Promise.all([
        fetch(`${API_BASE_URL}/retailers/pending`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/products/pending`, { credentials: "include" }),
      ]);
      const retData = await retRes.json();
      const prodData = await prodRes.json();
      if (!retRes.ok || !retData.success) throw new Error(retData.message || "Retailers load failed");
      if (!prodRes.ok || !prodData.success) throw new Error(prodData.message || "Products load failed");
      setPendingRetailers(retData.data);
      setPendingProducts(prodData.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingProducts.length}</div>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
              {pendingProducts.length > 0 && (
                <Link href="/admin/products">
                  <Button variant="link" className="p-0 h-auto mt-2">
                    View all →
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Retailers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingRetailers.length}</div>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
              {pendingRetailers.length > 0 && (
                <Link href="/admin/retailers">
                  <Button variant="link" className="p-0 h-auto mt-2">
                    View all →
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && !error && pendingProducts.length === 0 && pendingRetailers.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
                <p className="text-muted-foreground">No pending approvals at the moment.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && !error && (pendingProducts.length > 0 || pendingRetailers.length > 0) && (
          <div className="grid gap-6 lg:grid-cols-2">
            {pendingProducts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Pending Products</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendingProducts.slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="flex-1">
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {p.category} • £{Number(p.price || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {pendingProducts.length > 5 && (
                    <Link href="/admin/products">
                      <Button variant="outline" className="w-full">
                        View all {pendingProducts.length} products →
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}

            {pendingRetailers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Pending Retailers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendingRetailers.slice(0, 5).map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="flex-1">
                        <div className="font-semibold">{r.business_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {r.username} • {r.email}
                        </div>
                      </div>
                    </div>
                  ))}
                  {pendingRetailers.length > 5 && (
                    <Link href="/admin/retailers">
                      <Button variant="outline" className="w-full">
                        View all {pendingRetailers.length} retailers →
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AdminDashboardLayout>
  );
}

