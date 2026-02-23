export type AuthUser = {
  id: string;
  email: string;
  roles: string[];
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  acceptTerms: boolean;
  acceptPrivacyPolicy: boolean;
};
