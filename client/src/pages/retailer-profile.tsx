


import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { Store, MapPin, Phone, Heart, Share2, Image as ImageIcon, ArrowLeft, ChevronLeft } from "lucide-react";
import { ProductCard } from "@/components/product/ProductCard";
import { useToast } from "@/hooks/use-toast";
import { Product } from "@/lib/product";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

interface RetailerProfile {
  id: string;
  business_name: string;
  business_address?: string;
  postcode?: string;
  city?: string;
  phone?: string;
  banner_image?: string;
  follower_count: number;
  isFollowing?: boolean;
}

interface RetailerPost {
  id: string;
  content: string;
  images: string[];
  created_at: string;
}

export default function RetailerProfilePage() {
  const { retailerId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [retailer, setRetailer] = useState<RetailerProfile | null>(null);
  const [posts, setPosts] = useState<RetailerPost[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [togglingFollow, setTogglingFollow] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (retailerId) {
      fetchRetailerProfile();
      fetchPosts();
      fetchProducts();
      checkIfOwner();
    }
  }, [retailerId, user]);

  const checkIfOwner = async () => {
    if (!isAuthenticated || user?.role !== "retailer") {
      setIsOwner(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/retailer/profile`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Check if the current retailer's ID matches the profile ID
        setIsOwner(data.data.id === retailerId);
      }
    } catch (err) {
      console.error("Failed to check ownership:", err);
      setIsOwner(false);
    }
  };

  const fetchRetailerProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/retailer/${retailerId}/public`, {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRetailer(data.data);
        setFollowing(data.data.isFollowing || false);
      }
    } catch (err) {
      console.error("Failed to fetch retailer profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/retailer/${retailerId}/posts`);
      const data = await res.json();
      if (res.ok && data.success) {
        setPosts(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/products?retailerId=${retailerId}&isApproved=true`);
      const data = await res.json();
      if (res.ok && data.success) {
        // Map API response to Product type structure (same as search page)
        if (Array.isArray(data.data)) {
          setProducts(
            data.data.map((p: any) => ({
              id: p.id,
              name: p.name,
              price: parseFloat(p.price) || 0,
              retailer: p.retailer_name || retailer?.business_name || "Retailer",
              image: p.images?.[0] || "/opengraph.jpg",
              category: p.category,
              rating: p.averageRating || 0,
              reviews: p.reviewCount || 0,
              pickupTime: "30 mins",
              retailerPostcode: p.postcode,
              retailerCity: p.city,
            }))
          );
        } else if (data.data?.products && Array.isArray(data.data.products)) {
          // Handle paginated response structure
          setProducts(
            data.data.products.map((p: any) => ({
              id: p.id,
              name: p.name,
              price: parseFloat(p.price) || 0,
              retailer: p.retailer_name || retailer?.business_name || "Retailer",
              image: p.images?.[0] || "/opengraph.jpg",
              category: p.category,
              rating: p.averageRating || 0,
              reviews: p.reviewCount || 0,
              pickupTime: "30 mins",
              retailerPostcode: p.postcode,
              retailerCity: p.city,
            }))
          );
        } else {
          setProducts([]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    }
  };

  const handleFollow = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Login required",
        description: "Please login to follow retailers",
      });
      return;
    }

    setTogglingFollow(true);
    try {
      const method = following ? "DELETE" : "POST";
      const res = await fetch(`${API_BASE_URL}/retailer/${retailerId}/follow`, {
        method,
        credentials: "include",
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setFollowing(!following);
        if (following) {
          setRetailer((prev) =>
            prev ? { ...prev, follower_count: (prev.follower_count || 0) - 1 } : null
          );
        } else {
          setRetailer((prev) =>
            prev ? { ...prev, follower_count: (prev.follower_count || 0) + 1 } : null
          );
        }
        toast({
          title: following ? "Unfollowed" : "Following",
          description: following
            ? "You've unfollowed this retailer"
            : "You're now following this retailer",
        });
      }
    } catch (err) {
      console.error("Failed to toggle follow:", err);
    } finally {
      setTogglingFollow(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!retailer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Retailer not found</h1>
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Banner */}
      <div className="relative h-64 md:h-80 bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/10">     
        {retailer.banner_image ? (
          <img
            src={retailer.banner_image}
            alt={`${retailer.business_name} banner`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Store className="h-24 w-24 text-muted-foreground/40" />
          </div>
        )}
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Retailer Info */}
        <Card className="mb-6 -mt-20 relative z-10 shadow-lg border-border/50">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{retailer.business_name}</h1>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                  {retailer.city && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {retailer.city}
                      {retailer.postcode && `, ${retailer.postcode}`}
                    </div>
                  )}
                  {retailer.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {retailer.phone}
                    </div>
                  )}
                </div>
                {retailer.business_address && (
                  <p className="text-sm text-muted-foreground mb-4">{retailer.business_address}</p>
                )}
                <div className="flex items-center gap-4">
                  <Badge variant="secondary" className="gap-1">
                    <Heart className="h-3 w-3" />
                    {retailer.follower_count || 0} followers
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                {isAuthenticated && user?.role === "customer" && (
                  <Button
                    onClick={handleFollow}
                    disabled={togglingFollow}
                    variant={following ? "outline" : "default"}
                  >
                    <Heart className={`h-4 w-4 mr-2 ${following ? "fill-current" : ""}`} />
                    {following ? "Following" : "Follow"}
                  </Button>
                )}
                     {/* Back Button - Floating in top-left corner */}
                {isOwner && (
                <Link href="/retailer/dashboard">
                    <Button 
                    variant="outline" 
                    className= "bg-background/80 hover:bg-background"
                    >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back
                    </Button>
                </Link>
                )}
                <Button variant="outline">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Posts Feed */}
        {posts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-foreground">Updates</h2>
            <div className="space-y-4">
              {posts.map((post) => (
                <Card key={post.id} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <p className="whitespace-pre-wrap mb-4">{post.content}</p>
                    {post.images && post.images.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {post.images.map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt={`Post image ${idx + 1}`}
                            className="w-full h-48 object-cover rounded-lg"
                          />
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-4">
                      {new Date(post.created_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Products */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-foreground">Products</h2>
          {products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <Card className="border-border/50">
              <CardContent className="pt-6 text-center text-muted-foreground">
                No products available
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}