import { useEffect, useState } from "react";
import { AdminDashboardLayout } from "@/components/layout/AdminDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Package, AlertCircle } from "lucide-react";
import { useRequireRole } from "@/hooks/useRequireRole";
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

interface PendingProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  images: string[];
  retailer_name?: string;
  created_at: string;
}

export default function AdminProductsPage() {
  useRequireRole("admin", "/admin");
  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PendingProduct | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/products/pending`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load products");
      }
      console.log("Pending products data:", data.data); // Debug log
      setProducts(data.data || []);
    } catch (err: any) {
      console.error("Error loading products:", err); // Debug log
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveClick = (product: PendingProduct) => {
    setSelectedProduct(product);
    setApproveDialogOpen(true);
  };

  const handleApproveConfirm = async () => {
    if (!selectedProduct) return;

    setApproving(selectedProduct.id);
    try {
      const res = await fetch(`${API_BASE_URL}/products/${selectedProduct.id}/approve`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to approve product");
      }

      // Remove product from list
      setProducts((prev) => prev.filter((p) => p.id !== selectedProduct.id));
      setApproveDialogOpen(false);
      setSelectedProduct(null);
    } catch (err: any) {
      setError(err.message);
      setApproveDialogOpen(false);
      setSelectedProduct(null);
    } finally {
      setApproving(null);
    }
  };

  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Product Approvals</h1>
            <p className="text-muted-foreground">Review and approve pending products</p>
          </div>
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

        {!loading && !error && products.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No pending products</h3>
                <p className="text-muted-foreground">All products have been reviewed.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && !error && products.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <Card key={product.id} className="overflow-hidden">
                <div className="relative">
                  <img
                    src={product.images?.[0] || "/opengraph.jpg"}
                    alt={product.name}
                    className="w-full h-48 object-cover"
                  />
                  <Badge className="absolute top-2 right-2 bg-yellow-600 hover:bg-yellow-700">
                    Pending
                  </Badge>
                </div>
                <CardHeader>
                  <CardTitle className="text-lg line-clamp-1">{product.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold">£{Number(product.price || 0).toFixed(2)}</span>
                      <span className="text-sm text-muted-foreground">
                        Stock: {product.stock || 0}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {product.description || "No description"}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{product.category}</Badge>
                      {product.retailer_name && (
                        <Badge variant="outline" className="text-xs">
                          {product.retailer_name}
                        </Badge>
                      )}
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => handleApproveClick(product)}
                      disabled={approving === product.id}
                    >
                      {approving === product.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Approve Product
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Product?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve <strong>{selectedProduct?.name}</strong>? This will make it visible to all customers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!approving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApproveConfirm}
              disabled={!!approving}
              className="bg-primary"
            >
              {approving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                "Approve"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminDashboardLayout>
  );
}

