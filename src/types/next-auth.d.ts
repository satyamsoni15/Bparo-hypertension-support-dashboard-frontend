import type { DefaultSession } from "next-auth";
import type { ClinicRef, SupportRole } from "@/lib/types";

declare module "next-auth" {
  interface User {
    role: SupportRole;
    clinics: ClinicRef[];
    accessToken: string;
  }

  interface Session {
    user: {
      id: string;
      role: SupportRole;
      clinics: ClinicRef[];
    } & DefaultSession["user"];
    accessToken: string;
    // Set once the support API token inside this session has expired.
    error?: "AccessTokenExpired";
  }
}

// "next-auth/jwt" only re-exports the JWT type from "@auth/core/jwt", so the
// augmentation has to target the source module.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: SupportRole;
    clinics: ClinicRef[];
    accessToken: string;
    accessTokenExpires?: number;
    error?: "AccessTokenExpired";
  }
}
