import { Search, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useLocation } from "wouter";
import { ASSETS } from "@/lib/product";

export function Hero() {
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [, setLocation] = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      params.append("q", searchQuery.trim());
    }
    if (locationQuery.trim()) {
      params.append("loc", locationQuery.trim());
    }
    const queryString = params.toString();
    setLocation(`/search${queryString ? `?${queryString}` : ""}`);
  };

  return (
    <div className="relative w-full bg-background py-16 md:py-24 lg:py-32 flex flex-col items-center justify-center overflow-hidden">
      {/* Background Decoration - Subtle Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary/40 via-background to-background z-0" />
      
      <div className="container relative z-10 px-4 flex flex-col items-center text-center">
        <div className="mb-4 flex items-center justify-center">
          <img 
            src={ASSETS.logo} 
            alt="Localito Logo" 
            className="h-16 md:h-24 w-auto object-contain"
          />
        </div>
        
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl">
          <span className="font-semibold text-foreground">Buy now and pick up in store in minutes.</span>
        </p>

        {/* Main Search Bar Container */}
        <form 
          onSubmit={handleSearch}
          className="w-full max-w-3xl bg-card shadow-xl rounded-2xl border border-border/50 p-2 flex flex-col md:flex-row items-center gap-2 animate-in fade-in zoom-in duration-500"
        >
          {/* Product Search Input */}
          <div className="relative flex-1 w-full">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Search className="h-5 w-5" />
            </div>
            <Input 
              className="pl-10 h-12 border-none shadow-none focus-visible:ring-0 text-base bg-transparent" 
              placeholder="Search Let's Shop..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Divider (Desktop) */}
          <div className="hidden md:block h-8 w-px bg-border mx-2" />

          {/* Location Input */}
          <div className="relative flex-1 w-full">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-accent">
              <MapPin className="h-5 w-5" />
            </div>
            <Input 
              className="pl-10 h-12 border-none shadow-none focus-visible:ring-0 text-base bg-transparent" 
              placeholder="Where? Enter post code or city" 
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
            />
          </div>

          {/* Search Button */}
          <Button size="lg" type="submit" className="w-full md:w-auto h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold shadow-md transition-all hover:shadow-lg hover:scale-[1.02]">
            Search
          </Button>
        </form>

        {/* Quick Links */}
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
          <span>Popular nearby:</span>
          <button className="hover:text-primary underline decoration-dotted underline-offset-4">Fresh Bread</button>
          <button className="hover:text-primary underline decoration-dotted underline-offset-4">Craft Beer</button>
          <button className="hover:text-primary underline decoration-dotted underline-offset-4">Ceramics</button>
          <button className="hover:text-primary underline decoration-dotted underline-offset-4">Gifts</button>
        </div>
      </div>
    </div>
  );
}
