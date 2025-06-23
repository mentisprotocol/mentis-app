import { SubscriptionPlan, SubscriptionStatus } from '../types';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  is_verified: boolean;
  verification_token?: string;
  reset_password_token?: string;
  reset_password_expires?: Date;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  email: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  verification_token?: string;
}

export interface UpdateUserData {
  first_name?: string;
  last_name?: string;
  is_verified?: boolean;
  verification_token?: string;
  reset_password_token?: string;
  reset_password_expires?: Date;
  last_login?: Date;
}

export interface UserWithSubscription extends User {
  subscription?: {
    id: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    current_period_start: Date;
    current_period_end: Date;
    cancel_at_period_end: boolean;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_verified: boolean;
  created_at: Date;
  subscription?: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    current_period_end: Date;
  };
}

