export type UserProfile = {
  id: string;
  email: string;
  full_name?: string;
  credits?: number;
  subscription_tier?: string;
  subscription_status?: string;
  created_at?: string;
};

export type Stats = {
  users: {
    total: number;
    active: number;
    free: number;
    premium: number;
  };
  credits: {
    total: number;
    average: number;
  };
  images: {
    wardrobe: number;
    profiles: number;
  };
};

export type AdminSession = {
  token: string;
  email: string;
};

