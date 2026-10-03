"use client";

import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { Auth } from "@/server/auth/config";

/** Tarayıcı tarafı oturum istemcisi. Aynı origin'deki /api/auth uçlarını kullanır. */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>()],
});
