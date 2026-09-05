export interface UserProfile {
  id?: number | string;
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
}

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
}
