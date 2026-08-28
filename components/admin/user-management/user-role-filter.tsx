"use client";

import { ListFilterIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import type { WebookManagedRole } from "../../../lib/webook-users";
import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

interface UserRoleFilterProps {
  roles: WebookManagedRole[];
  selectedRoleIds: number[];
}

export function UserRoleFilter({ roles, selectedRoleIds }: UserRoleFilterProps) {
  const router = useRouter();

  function toggleRole(roleId: number, checked: boolean) {
    const nextRoleIds = checked
      ? [...selectedRoleIds, roleId]
      : selectedRoleIds.filter((selectedRoleId) => selectedRoleId !== roleId);
    const params = new URLSearchParams(window.location.search);
    params.delete("page");
    if (nextRoleIds.length > 0) {
      params.set("roles", [...new Set(nextRoleIds)].sort((left, right) => left - right).join(","));
    } else {
      params.delete("roles");
    }
    router.push(`/admin/users?${params.toString()}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline">
          <ListFilterIcon aria-hidden />
          กรองสิทธิ์ผู้ใช้{selectedRoleIds.length > 0 ? ` (${selectedRoleIds.length})` : ""}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>สิทธิ์ผู้ใช้</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roles.map((role) => (
          <DropdownMenuCheckboxItem
            checked={selectedRoleIds.includes(role.id)}
            key={role.id}
            onCheckedChange={(checked) => toggleRole(role.id, checked === true)}
            onSelect={(event) => event.preventDefault()}
          >
            {role.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
