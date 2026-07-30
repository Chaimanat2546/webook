import { Badge } from "../../ui/badge";
import type { ManagedUserStatus } from "./types";
import { getUserStatusPresentation } from "./view-model";

export function UserStatusBadge({ status }: { status: ManagedUserStatus }) {
  const presentation = getUserStatusPresentation(status);
  return (
    <Badge variant={presentation.variant}>{presentation.label}</Badge>
  );
}
