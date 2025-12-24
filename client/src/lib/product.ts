// Public assets are served at the root path
const logoImage = "/logo.png";
const darklogoImage = "/logo-dark.png";

export interface Product {
  id: string;
  name: string;
  price: number;
  retailer: string;
  image: string;
  category: string;
  rating: number; 
  reviews: number;
  pickupTime: string;
  isNew?: boolean;
  discount?: number;
  // Location information from retailer
  retailerPostcode?: string;
  retailerCity?: string;
  // Additional fields for retailer view
  isApproved?: boolean;
  stock?: number;
  description?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export const CATEGORIES: Category[] = [
  { id: "1", name: "Food & Drink", slug: "food-drink" },
  { id: "2", name: "Arts & Crafts", slug: "arts-crafts" },
  { id: "3", name: "Home & Living", slug: "home-living" },
  { id: "4", name: "Fashion", slug: "fashion" },
  { id: "5", name: "Health & Beauty", slug: "health-beauty" },
];

export const ASSETS = {
  logo: logoImage,
  darklogo: darklogoImage
};
