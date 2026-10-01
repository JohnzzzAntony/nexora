"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { settingControlAction } from "@/server/work/setting-actions";
export function SettingControls({
  section,
  id,
  active,
  isDefault,
  revoked,
}: {
  section: string;
  id: string;
  active?: boolean;
  isDefault?: boolean;
  revoked?: boolean;
}) {
  const [pending, start] = useTransition();
  const run = (command: string) => {
    if (
      command === "revoke" &&
      !window.confirm(
        "Revoke this API key? Applications using it will lose access.",
      )
    )
      return;
    start(async () => {
      const r = await settingControlAction(section, id, command);
      if (!r.ok) toast.error(r.error.message);
      else toast.success("Updated");
    });
  };
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {section === "api" && !revoked && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run("revoke")}
        >
          Revoke key
        </Button>
      )}
      {["automations", "webhooks", "sla"].includes(section) && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run("toggle")}
        >
          {active ? "Disable" : "Enable"}
        </Button>
      )}
      {section === "sla" &&
        (isDefault ? (
          <span className="self-center text-xs text-primary">
            Default policy
          </span>
        ) : (
          active && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run("default")}
            >
              Make default
            </Button>
          )
        ))}
    </div>
  );
}
