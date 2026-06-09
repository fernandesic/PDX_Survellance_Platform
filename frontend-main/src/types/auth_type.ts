import type { BaseResponse } from ".";


export interface LoginData {
  email: string;
  password: string;
}

export interface TenantInfo {
  id: number;
  name: string;
  iso_code: string;
  is_continental: boolean;
}

export interface LoginResponse extends BaseResponse<{
  access: string;
  refresh: string;
  user: {
    email: string;
    full_name: string;
    id: number;
    is_supervisor: boolean;
    supervisor_teams: { id: number; name: string; code: string }[];
    role: 'super_admin' | 'admin' | 'user' | 'supplier' | 'department' | null;
    is_super_admin: boolean;
    tenant: TenantInfo | null;
  }
}> { }

export interface SessionResponse extends BaseResponse<{
  user: LoginResponse["data"]["user"];
}> { }
