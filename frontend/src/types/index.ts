export interface WardrobeItem {
  id: string;
  user_id: string;
  name: string;
  image_url: string;  // Supabase Storage URL (full size)
  thumbnail_url: string;  // Supabase Storage URL (300x300 thumbnail)
  image_base64?: string;  // Deprecated - for backward compatibility
  category: ClothingCategory;
  season: Season;
  color: string;
  created_at: string;
}

export type ClothingCategory = 
  | 'tops'
  | 'bottoms'
  | 'dresses'
  | 'outerwear'
  | 'shoes'
  | 'accessories';

export type Season = 
  | 'summer'
  | 'winter'
  | 'spring'
  | 'autumn'
  | 'all';

export interface TryOnResult {
  id: string;
  user_id: string;
  wardrobe_item_id: string;
  result_image_url: string;  // Supabase Storage URL
  result_image_base64?: string;  // Deprecated - for backward compatibility
  created_at: string;
}

export interface WeatherData {
  temp: number;
  description: string;
  icon: string;
  city: string;
  isCold: boolean;
  isRainy: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  credits: number;
  price_try: number;
  price_usd: number;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    credits: 15,
    price_try: 149,
    price_usd: 3.99,
  },
  {
    id: 'standard',
    name: 'Standard',
    credits: 30,
    price_try: 199,
    price_usd: 4.99,
  },
  {
    id: 'premium',
    name: 'Premium',
    credits: 90,
    price_try: 499,
    price_usd: 11.99,
  },
];

export const CLOTHING_COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Gray', value: '#808080' },
  { name: 'Navy', value: '#000080' },
  { name: 'Blue', value: '#0000FF' },
  { name: 'Red', value: '#FF0000' },
  { name: 'Green', value: '#008000' },
  { name: 'Yellow', value: '#FFFF00' },
  { name: 'Pink', value: '#FFC0CB' },
  { name: 'Purple', value: '#800080' },
  { name: 'Brown', value: '#A52A2A' },
  { name: 'Beige', value: '#F5F5DC' },
];
