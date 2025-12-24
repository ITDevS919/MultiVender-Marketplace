import { Product } from "@/lib/product";
import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Clock, MapPin, Loader2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [adding, setAdding] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  useEffect(() => {
    if (isAuthenticated && product.id) {
      checkFavoriteStatus();
    }
  }, [isAuthenticated, product.id]);

  useEffect(() => {
    const handleWishlistChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      // Only refresh if this product's wishlist status changed
      if (customEvent.detail?.productId === product.id && isAuthenticated) {
        // Update immediately from event detail, then verify with API
        setIsFavorite(customEvent.detail.isFavorite);
        // Optionally verify with API after a short delay
        setTimeout(() => {
          checkFavoriteStatus();
        }, 100);
      }
    };
    
    window.addEventListener('wishlist-changed', handleWishlistChange);
    return () => {
      window.removeEventListener('wishlist-changed', handleWishlistChange);
    };
  }, [isAuthenticated, product.id]);

  const checkFavoriteStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/wishlist/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productIds: [product.id] }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsFavorite(data.data.includes(product.id));
      }
    } catch (error) {
      // Silently fail - wishlist is optional
    }
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setLocation("/login/customer");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`${API_BASE_URL}/cart`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to add to cart");
      }
      toast({
        title: "Added to cart",
        description: `${product.name} was added to your cart.`,
      });
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes("401")) {
        setLocation("/login/customer");
      } else {
        toast({
          title: "Could not add to cart",
          description: err?.message || "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setAdding(false);
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
    const newFavoriteState = !isFavorite; // Store the new state
    try {
      if (isFavorite) {
        // Remove from wishlist
        const res = await fetch(`${API_BASE_URL}/wishlist/${product.id}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setIsFavorite(false);
          // Dispatch custom event to notify other components
          window.dispatchEvent(new CustomEvent('wishlist-changed', { 
            detail: { productId: product.id, isFavorite: false } 
          }));
          toast({
            title: "Removed from wishlist",
            description: `${product.name} was removed from your wishlist.`,
          });
        } else {
          // Revert on error
          setIsFavorite(true);
        }
      } else {
        // Add to wishlist
        const res = await fetch(`${API_BASE_URL}/wishlist/${product.id}`, {
          method: "POST",
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setIsFavorite(true);
          // Dispatch custom event to notify other components
          window.dispatchEvent(new CustomEvent('wishlist-changed', { 
            detail: { productId: product.id, isFavorite: true } 
          }));
          toast({
            title: "Added to wishlist",
            description: `${product.name} was added to your wishlist.`,
          });
        } else {
          // Revert on error
          setIsFavorite(false);
        }
      }
      // Don't call checkFavoriteStatus here - we already set the state above
    } catch (err: any) {
      // Revert state on error
      setIsFavorite(!newFavoriteState);
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
    <Link href={`/product/${product.id}`} className="block">
      <Card className="group overflow-hidden rounded-xl border-border/60 bg-card transition-all hover:shadow-lg hover:border-primary/20">
        {/* Image Container */}
        <div className="relative group aspect-square overflow-hidden"> 
          <img 
            src={product.image} 
            alt={product.name} 
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          <button
            onClick={handleToggleFavorite}
            disabled={togglingFavorite}
            className="absolute top-2 right-2 p-2 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors z-10"
            aria-label={isFavorite ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              className={`h-5 w-5 ${
                isFavorite
                  ? "fill-red-500 text-red-500"
                  : "text-muted-foreground hover:text-red-500"
              } transition-colors`}
            />
          </button>
          {product.isNew && (
            <Badge className="absolute left-3 top-3 bg-accent text-accent-foreground hover:bg-accent font-medium">
              New Arrival
            </Badge>
          )}
          {product.discount && (
            <Badge className="absolute right-3 top-3 bg-destructive text-destructive-foreground hover:bg-destructive font-medium">
              -{product.discount}%
            </Badge>
          )}
        </div>

        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate max-w-[120px]">{product.retailer}</span>
            </div>
            <div className="flex items-center gap-1 text-amber-500">
              <Star className="h-3 w-3 fill-current" />
              <span className="font-medium text-foreground">{product.rating}</span>
              <span className="text-muted-foreground">({product.reviews})</span>
            </div>
          </div>

          <h3 className="font-heading text-lg font-semibold leading-tight text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
            {product.name}
          </h3>

          <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 w-fit px-2 py-1 rounded-md">
            <Clock className="h-3 w-3" />
            Pickup in {product.pickupTime}
          </div>
        </CardContent>

        <CardFooter className="p-4 pt-0 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Price</span>
            <span className="text-lg font-bold text-primary">£{product.price.toFixed(2)}</span>
          </div>
          <Button
            size="sm"
            className="rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80"
            onClick={handleAddToCart}
            disabled={adding}
          >
            {adding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add to Cart"
            )}
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
}
