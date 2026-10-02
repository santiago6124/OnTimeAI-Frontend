"use client";

import { Check, Building2, UserRound, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
  const { profile, setProfile, overridden, accountProfile } = useProfile();
  const current = PROFILES.find((p) => p.id === profile)!;
  const Icon = profile === "airline" ? Building2 : UserRound;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="gap-2" />}>
        <Icon className="size-4" />
        <span className="hidden sm:inline">{current.label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
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
                {overridden && profile === p.id ? (
                  <Check className="size-4 opacity-70 mt-0.5" />
                ) : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>

        {/* Sin esta opcion el override era un camino de ida: el desplegable
            solo ofrecia los dos perfiles, y lo guardado le gana al de la
            cuenta. Quien lo abriera una vez quedaba con la vista congelada en
            ese navegador, y cambiar el perfil en Ajustes no hacia nada. */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => setProfile(null)}
          className="flex items-start gap-3 py-2"
        >
          <RotateCcw className="size-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium">Seguir mi cuenta</div>
            <div className="text-xs text-muted-foreground">
              {accountProfile === "airline"
                ? "Tu cuenta está en Operaciones"
                : accountProfile === "passenger"
                  ? "Tu cuenta está en Viajero"
                  : "Usa el perfil guardado en tu cuenta"}
            </div>
          </div>
          {!overridden ? (
            <Check className="size-4 opacity-70 mt-0.5" />
          ) : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
