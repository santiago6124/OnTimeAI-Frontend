"use client";

import { Check, Building2, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  PROFILES,
  useProfile,
} from "@/components/providers/profile-provider";

export function ProfileSwitcher() {
  const { profile, setProfile } = useProfile();
  const current = PROFILES.find((p) => p.id === profile)!;
  const Icon = profile === "airline" ? Building2 : UserRound;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="gap-2" />}>
        <Icon className="size-4" />
        <span className="hidden sm:inline">{current.label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Perfil de usuario</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PROFILES.map((p) => {
          const PIcon = p.id === "airline" ? Building2 : UserRound;
          return (
            <DropdownMenuItem
              key={p.id}
              onSelect={() => setProfile(p.id)}
              className="flex items-start gap-3 py-2"
            >
              <PIcon className="size-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-xs text-muted-foreground">
                  {p.description}
                </div>
              </div>
              {profile === p.id ? (
                <Check className="size-4 opacity-70 mt-0.5" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
