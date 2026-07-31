"use client";

import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "../../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../../ui/empty";
import { Input } from "../../ui/input";
import type { UserManagerProject } from "./types";
import { getProjectLifecycle } from "./view-model";

const LIFECYCLE_LABEL = {
  healthy: "พร้อมใช้งาน",
  unhealthy: "ต้องตรวจสอบ",
  provisioning: "กำลังตั้งค่า",
  reactivation_required: "ต้องเปิดใช้งานใหม่",
  deactivated: "ปิดใช้งาน",
} as const;

export function ProjectList({
  projects,
  selectedProjectId,
  isBusy,
  onSelect,
}: {
  projects: UserManagerProject[];
  selectedProjectId: string | null;
  isBusy: boolean;
  onSelect(projectId: string): void;
}) {
  const [query, setQuery] = useState("");
  const visibleProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? projects.filter(
          (project) =>
            project.displayName.toLowerCase().includes(normalized) ||
            project.id.toLowerCase().includes(normalized),
        )
      : projects;
  }, [projects, query]);

  return (
    <Card className="min-w-0">
      <CardHeader className="gap-3">
        <CardTitle className="text-sm">ระบบบ้านพัก</CardTitle>
        <div className="relative">
          <SearchIcon
            aria-hidden
            className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="ค้นหาระบบบ้านพัก"
            className="pl-8"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาชื่อระบบบ้านพัก"
            value={query}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleProjects.length === 0 ? (
          <Empty className="min-h-40 border">
            <EmptyHeader>
              <EmptyTitle>
                {projects.length === 0 ? "ยังไม่มีโครงการ" : "ไม่พบโครงการ"}
              </EmptyTitle>
              <EmptyDescription>
                เพิ่ม Tenant ผ่านเครื่องมือ provisioning
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          visibleProjects.map((project) => {
            const lifecycle = getProjectLifecycle(project);
            return (
              <button
                aria-pressed={project.id === selectedProjectId}
                className="w-full min-w-0 rounded-lg border p-3 text-left transition hover:bg-muted/60 aria-pressed:border-primary aria-pressed:bg-primary/5"
                key={project.id}
                disabled={isBusy}
                onClick={() => onSelect(project.id)}
                type="button"
              >
                <span className="flex items-start justify-between gap-2">
                  <span
                    className="min-w-0 truncate text-sm font-medium"
                    title={project.displayName}
                  >
                    {project.displayName}
                  </span>
                  <Badge
                    className="shrink-0"
                    variant={lifecycle === "healthy" ? "default" : "secondary"}
                  >
                    {LIFECYCLE_LABEL[lifecycle]}
                  </Badge>
                </span>
                <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                  {project.id}
                </span>
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
