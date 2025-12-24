import { Navbar } from "@/components/layout/Navbar";
import { Hero } from "@/components/home/Hero";
import { ProductCard } from "@/components/product/ProductCard";
import { CATEGORIES, ASSETS } from "@/lib/product";
import { ArrowRight, Store, ShieldCheck, Leaf, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/product";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  const { isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast()

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/products?isApproved=true`);
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.data)) {
          // Get first 4 products as featured
          const products = data.data.slice(0, 4).map((p: any) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            retailer: p.retailer_name || "Retailer",
            image: p.images?.[0] || "/opengraph.jpg",
            category: p.category,
            rating: p.averageRating || 0,  // Changed from 4.5
            reviews: p.reviewCount || 0,    // Changed from 0
            pickupTime: "30 mins",
            retailerPostcode: p.postcode,
            retailerCity: p.city,
          }));
          setFeaturedProducts(products);
        }
      } catch (error) {
        console.error("Failed to fetch featured products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedProducts();
  }, [API_BASE_URL]);

  const [isFavorite, setIsFavorite] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);

  useEffect(() => {
    if (isAuthenticated && featuredProducts.length > 0) {
      checkFavoriteStatus();
    }
  }, [isAuthenticated, featuredProducts]);

  const checkFavoriteStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/wishlist/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productIds: featuredProducts.map(p => p.id) }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsFavorite(data.data.includes(featuredProducts[0].id)); // Assuming first product is representative
      }
    } catch (error) {
      // Silently fail - wishlist is optional
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated) {
      setLocation("/login/customer");
      return;
    }

    setTogglingFavorite(true);
    try {
      if (isFavorite) {
        // Remove from wishlist
        const res = await fetch(`${API_BASE_URL}/wishlist/${featuredProducts[0].id}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setIsFavorite(false);
          toast({
            title: "Removed from wishlist",
            description: `${featuredProducts[0].name} was removed from your wishlist.`,
          });
        }
      } else {
        // Add to wishlist
        const res = await fetch(`${API_BASE_URL}/wishlist/${featuredProducts[0].id}`, {
          method: "POST",
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setIsFavorite(true);
          toast({
            title: "Added to wishlist",
            description: `${featuredProducts[0].name} was added to your wishlist.`,
          });
        }
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to update wishlist",
        variant: "destructive",
      });
    } finally {
      setTogglingFavorite(false);
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/10 selection:text-primary">
      <Navbar />
      
      <main>
        <Hero />

        {/* Features / Value Prop */}
        <section className="border-y border-border/40 bg-secondary/20 py-12">
          <div className="container mx-auto px-4">
            <div className="grid gap-8 md:grid-cols-3">
              <div className="flex flex-col items-center text-center p-4">
                <div className="mb-4 rounded-full bg-primary/10 p-3 text-primary">
                  <Store className="h-8 w-8" />
                </div>
                <h3 className="mb-2 font-heading text-xl font-bold">Support Local</h3>
                <p className="text-muted-foreground">Directly support independent retailers in Manchester with every purchase.</p>
              </div>
              <div className="flex flex-col items-center text-center p-4">
                <div className="mb-4 rounded-full bg-primary/10 p-3 text-primary">
                  <Leaf className="h-8 w-8" />
                </div>
                <h3 className="mb-2 font-heading text-xl font-bold">Sustainable Choice</h3>
                <p className="text-muted-foreground">Reduce your carbon footprint by shopping local and collecting in-store.</p>
              </div>
              <div className="flex flex-col items-center text-center p-4">
                <div className="mb-4 rounded-full bg-primary/10 p-3 text-primary">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <h3 className="mb-2 font-heading text-xl font-bold">Verified Sellers</h3>
                <p className="text-muted-foreground">Every retailer is vetted to ensure quality and authentic local products.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h2 className="font-heading text-3xl font-bold tracking-tight text-primary">Explore Categories</h2>
                <p className="mt-2 text-muted-foreground">Find exactly what you're looking for.</p>
              </div>
              <Button variant="outline" asChild className="hidden sm:flex">
                <Link href="/categories">View All Categories</Link>
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {CATEGORIES.map((category) => (
                <Link key={category.id} href={`/search?category=${category.slug}`}>
                  <div className="group cursor-pointer rounded-xl border border-border bg-card p-6 text-center transition-all hover:border-primary hover:shadow-md">
                    <div className="mb-3 text-4xl">
                      {/* Simple Emoji/Icon placeholders for categories if no images */}
                      {category.slug === 'food-drink' && '🥐'}
                      {category.slug === 'arts-crafts' && '🎨'}
                      {category.slug === 'home-living' && '🏠'}
                      {category.slug === 'fashion' && '👗'}
                      {category.slug === 'health-beauty' && '💄'}
                    </div>
                    <h3 className="font-medium group-hover:text-primary">{category.name}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Products */}
        <section className="py-16 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h2 className="font-heading text-3xl font-bold tracking-tight text-primary">Fresh in Manchester</h2>
                <p className="mt-2 text-muted-foreground">New arrivals from your favorite local spots.</p>
              </div>
              <Link href="/search" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                See all products <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : featuredProducts.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {featuredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No products available at the moment.</p>
              </div>
            )}
          </div>
        </section>

        {/* Call to Action for Retailers */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-2xl">
              <div className="grid gap-8 px-8 py-12 md:grid-cols-2 md:px-16 md:py-20 items-center">
                <div className="space-y-6">
                  <h2 className="font-heading text-3xl font-bold md:text-4xl">Are you a local independent business?</h2>
                  <p className="text-lg text-primary-foreground/90">
                    Join Localito today and reach thousands of local customers. Set up your store in minutes and start selling with 0% listing fees.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Button size="lg" variant="secondary" className="text-primary font-bold">
                      Start Selling
                    </Button>
                    <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                      Learn More
                    </Button>
                  </div>
                </div>
                <div className="relative hidden md:block h-full min-h-[300px]">
                   {/* Abstract pattern or illustration placeholder */}
                   <div className="absolute inset-0 bg-white/10 rounded-2xl transform rotate-3"></div>
                   <div className="absolute inset-0 bg-white/5 rounded-2xl transform -rotate-2"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                      <Store className="h-32 w-32 text-white/20" />
                   </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#0A1A3A] text-primary-foreground">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Localito Brand Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <img 
                  src={ASSETS.darklogo} 
                  alt="Localito Logo" 
                  className="h-20 w-auto object-contain"
                />
              </div>
            </div>

            {/* Browse Column */}
            <div className="space-y-4">
              <h4 className="text-base font-bold">Browse</h4>
              <ul className="space-y-2 text-sm text-primary-foreground/70">
                <li>
                  <Link href="/search" className="hover:text-primary-foreground transition-colors">
                    Products
                  </Link>
                </li>
                <li>
                  <Link href="/search?category=all" className="hover:text-primary-foreground transition-colors">
                    Categories
                  </Link>
                </li>
                <li>
                  <Link href="/retailer/dashboard" className="hover:text-primary-foreground transition-colors">
                    Stores
                  </Link>
                </li>
              </ul>
            </div>

            {/* Help Column */}
            <div className="space-y-4">
              <h4 className="text-base font-bold">Help</h4>
              <ul className="space-y-2 text-sm text-primary-foreground/70">
                <li>
                  <Link href="/faq" className="hover:text-primary-foreground transition-colors">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-primary-foreground transition-colors">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/support" className="hover:text-primary-foreground transition-colors">
                    Support
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal Column */}
            <div className="space-y-4">
              <h4 className="text-base font-bold">Legal</h4>
              <ul className="space-y-2 text-sm text-primary-foreground/70">
                <li>
                  <Link href="/privacy" className="hover:text-primary-foreground transition-colors">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-primary-foreground transition-colors">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="/cookies" className="hover:text-primary-foreground transition-colors">
                    Cookies
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        {/* Bottom Separator */}
        <div className="border-t border-primary-foreground/20">
          <div className="container mx-auto px-4 py-4">
            <p className="text-sm text-primary-foreground/70 text-center">
              &copy; 2025 Localito Manchester. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
