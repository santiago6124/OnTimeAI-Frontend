"use client";

import * as React from "react";
import { ChevronDown, Copy, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RawPayloadPanel({
  title,
  description,
  url,
  payload,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  url?: string;
  payload: unknown;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [copied, setCopied] = React.useState(false);

  const json = React.useMemo(() => JSON.stringify(payload, null, 2), [payload]);
  const bytes = new Blob([json]).size;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {description ? (
              <CardDescription className="text-xs">
                {description}
              </CardDescription>
            ) : null}
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline"
              >
                <ExternalLink className="size-3" />
                {url}
              </a>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">
              {(bytes / 1024).toFixed(1)} KB
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={copy}
              aria-label="Copiar JSON"
            >
              <Copy className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen((v) => !v)}
              className="gap-1"
            >
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform",
                  open && "rotate-180",
                )}
              />
              {open ? "Ocultar" : "Ver JSON"}
            </Button>
          </div>
        </div>
        {copied ? (
          <span className="absolute right-4 top-14 rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
            Copiado
          </span>
        ) : null}
      </CardHeader>
      {open ? (
        <CardContent>
          <pre className="max-h-[480px] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {json}
          </pre>
        </CardContent>
      ) : null}
    </Card>
  );
}
