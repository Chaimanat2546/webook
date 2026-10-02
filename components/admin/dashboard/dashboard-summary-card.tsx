import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";

interface DashboardSummaryCardProps {
  children: ReactNode;
  status?: ReactNode;
  title: string;
}

export function DashboardSummaryCard({ children, status, title }: DashboardSummaryCardProps) {
  return <Card size="sm">
    <CardHeader className="!flex items-center justify-between pb-0">
      <CardTitle className="font-semibold">{title}</CardTitle>
      {status}
    </CardHeader>
    <CardContent className="space-y-4">{children}</CardContent>
  </Card>;
}
