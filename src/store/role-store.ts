"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Role } from "@/types";

interface RoleState {
  role: Role;
  authedUserId: string | null;
  setRole: (role: Role) => void;
  setAuthedUserId: (id: string | null) => void;
  logout: () => void;
}

const ROLE_DEFAULT_USER: Record<Role, string> = {
  manager: "m-1",
  teacher: "t-nancy",
  admin: "a-nancy",
};

export const useRoleStore = create<RoleState>()(
  persist(
    (set) => ({
      role: "admin",
      authedUserId: ROLE_DEFAULT_USER.admin,
      setRole: (role) => set({ role, authedUserId: ROLE_DEFAULT_USER[role] }),
      setAuthedUserId: (id) => set({ authedUserId: id }),
      // Sign-out must NOT reveal a higher-privilege view: reset to the LEAST
      // privileged role (manager), never admin. The nav also derives from the
      // real session now, so this is only a fallback for the signed-out instant.
      logout: () => set({ role: "manager", authedUserId: null }),
    }),
    {
      name: "bcj-learn:role",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? window.localStorage : (undefined as unknown as Storage))),
    },
  ),
);
