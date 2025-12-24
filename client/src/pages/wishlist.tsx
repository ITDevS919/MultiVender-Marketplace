import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { ProductCard } from "@/components/product/ProductCard";
import { Button } from "@/components/ui/button";
import { Loader2, Heart } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import type { Product } from "@/lib/product";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function WishlistPage() {
  const { isAuthenticated } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    loadWishlist();
  }, [isAuthenticated]);

  const loadWishlist = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/wishlist`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load wishlist");
      }

      // Transform API data to match Product interface
      const transformedProducts: Product[] = data.data.map((p: any) => ({
        id: p.product_id,
        name: p.name,
        price: parseFloat(p.price) || 0,  // Parse price as float
        retailer: p.retailer_name || "Retailer",
        image: (Array.isArray(p.images) && p.images[0]) || "/opengraph.jpg",  // Better array handling
        category: p.category || "",
        rating: parseFloat(p.average_rating) || 0,  // Parse rating as float
        reviews: parseInt(p.review_count) || 0,    // Parse reviews as integer
        pickupTime: "30 mins",
        retailerPostcode: undefined,
        retailerCity: undefined,
      }));

      setProducts(transformedProducts);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="container mx-auto px-4 py-10">
          <div className="text-center py-20">
            <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-3xl font-bold mb-4">Sign in to view your wishlist</h1>
            <p className="text-muted-foreground mb-6">
              Save your favorite products and access them anytime.
            </p>
            <Link href="/login/customer">
              <Button>Sign In</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">My Wishlist</h1>
          <p className="text-muted-foreground">
            {products.length === 0
              ? "Your saved products will appear here"
              : `${products.length} item${products.length !== 1 ? "s" : ""} saved`}
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {products.length === 0 ? (
              <div className="text-center py-20">
                <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-2xl font-bold mb-2">Your wishlist is empty</h2>
                <p className="text-muted-foreground mb-6">
                  Start adding products you love to your wishlist.
                </p>
                <Link href="/search">
                  <Button>Browse Products</Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
