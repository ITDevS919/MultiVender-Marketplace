import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, Package, CheckCircle2, XCircle, Edit, Trash2, Heart } from "lucide-react";
import { useRequireRole } from "@/hooks/useRequireRole";
import { CreateProductModal } from "@/components/product/CreateProductModal";
import type { Product } from "@/lib/product";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function RetailerProductsPage() {
  useRequireRole("retailer", "/login/retailer");
  const { isAuthenticated } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/retailer/products`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Failed to load products");
        }

        // Transform API data to match Product interface
        const transformedProducts: Product[] = data.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: parseFloat(p.price) || 0,  // Parse price as float
          retailer: "Your Store",
          image: (Array.isArray(p.images) && p.images[0]) || "/opengraph.jpg",  // Better array handling
          category: p.category || "",
          rating: parseFloat(p.averageRating) || 0,  // Parse rating
          reviews: parseInt(p.reviewCount) || 0,      // Parse reviews
          pickupTime: "30 mins",
          isNew: false,
          retailerPostcode: undefined,
          retailerCity: undefined,
          isApproved: p.isApproved,
          stock: parseInt(p.stock) || 0,  // Parse stock
          description: p.description || "",
        }));

        setProducts(transformedProducts);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const approvedCount = products.filter((p) => p.isApproved).length;
  const pendingCount = products.filter((p) => !p.isApproved).length;

  const handleEdit = (product: Product) => {
    setEditProduct(product);
    setEditModalOpen(true);
  };

  const handleDeleteClick = (product: Product) => {
    setDeleteProduct(product);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteProduct) return;

    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/products/${deleteProduct.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to delete product");
      }

      // Remove product from list
      setProducts((prev) => prev.filter((p) => p.id !== deleteProduct.id));
      setDeleteDialogOpen(false);
      setDeleteProduct(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete product");
      setDeleteDialogOpen(false);
      setDeleteProduct(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    // Refresh products list
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/retailer/products`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data.success) {
          const transformedProducts: Product[] = data.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: parseFloat(p.price) || 0,
            retailer: "Your Store",
            image: (Array.isArray(p.images) && p.images[0]) || "/opengraph.jpg",
            category: p.category || "",
            rating: parseFloat(p.averageRating) || 0,
            reviews: parseInt(p.reviewCount) || 0,
            pickupTime: "30 mins",
            isNew: false,
            retailerPostcode: undefined,
            retailerCity: undefined,
            isApproved: p.isApproved,
            stock: parseInt(p.stock) || 0,
            description: p.description || "",
          }));
          setProducts(transformedProducts);
        }
      } catch (err) {
        // Silently fail - user can refresh manually if needed
      }
    };
    fetchProducts();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Your Products</h1>
            <p className="text-muted-foreground">Manage your product catalog</p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            Create Product
          </Button>
        </div>

        {/* Header Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{products.length}</div>
              <p className="text-xs text-muted-foreground">All your products</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
              <p className="text-xs text-muted-foreground">Visible to customers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
              <XCircle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">Awaiting admin review</p>
            </CardContent>
          </Card>
        </div>

        {/* Products List */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {error && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-destructive">{error}</div>
            </CardContent>
          </Card>
        )}

        {!loading && !error && (
          <>
            {products.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No products yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first product to start selling
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <Card key={product.id} className="overflow-hidden">
                    <div className="relative">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-48 object-cover"
                      />
                      <Badge
                        className={`absolute top-2 right-2 ${
                          product.isApproved
                            ? "bg-green-600 hover:bg-green-700"
                            : "bg-yellow-600 hover:bg-yellow-700"
                        }`}
                      >
                        {product.isApproved ? "Approved" : "Pending"}
                      </Badge>
                    </div>
                    <CardHeader>
                      <CardTitle className="text-lg line-clamp-1">{product.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-2xl font-bold">£{product.price.toFixed(2)}</span>
                          <span className="text-sm text-muted-foreground">
                            Stock: {product.stock || 0}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {product.description || "No description"}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{product.category}</Badge>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleEdit(product)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleDeleteClick(product)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Product Modal */}
      <CreateProductModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={handleEditSuccess}
      />

      {/* Edit Product Modal */}
      <CreateProductModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        product={editProduct}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the product{" "}
              <strong>{deleteProduct?.name}</strong> and remove it from your store.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

