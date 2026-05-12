"use client";

import * as React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  /** The user's full name — used for initials fallback and the alt text. */
  name: string;
  /** Optional uploaded profile picture URL (from Supabase Storage `avatars` bucket). */
  avatarUrl?: string | null;
  /** Hex colour for the initials fallback background. */
  avatarColor?: string;
  /** Avatar size — maps to the underlying primitive's `size` prop. */
  size?: "default" | "sm" | "lg";
  className?: string;
}

/**
 * Single source of truth for rendering user avatars across the platform.
 *
 *  - If `avatarUrl` is set → renders the uploaded image (cropped to circle).
 *  - If the image fails to load OR `avatarUrl` is empty → renders coloured
 *    initials over `avatarColor` background.
 */
export function UserAvatar({
  name,
  avatarUrl,
  avatarColor = "#1F3A5F",
  size = "default",
  className,
}: UserAvatarProps) {
  return (
    <Avatar size={size} className={cn("border", className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
      <AvatarFallback
        style={{ background: avatarColor, color: "white" }}
        className="font-semibold"
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
