"use client";

import { Tabs, Badge } from "antd";
import { StockGroup } from "@prisma/client";

interface GroupTabsProps {
  groups: (StockGroup & { _count?: { stocks: number } })[];
  activeGroupId: string | null;
  onGroupChange: (groupId: string | null) => void;
  totalCount: number;
}

export function GroupTabs({
  groups,
  activeGroupId,
  onGroupChange,
  totalCount,
}: GroupTabsProps) {
  const items = [
    {
      key: "all",
      label: (
        <span>
          全部 <Badge count={totalCount} size="small" className="ml-1" />
        </span>
      ),
    },
    ...groups.map((group) => ({
      key: group.id,
      label: (
        <span style={{ color: group.color || undefined }}>
          {group.name}{" "}
          <Badge
            count={group._count?.stocks || 0}
            size="small"
            className="ml-1"
          />
        </span>
      ),
    })),
  ];

  return (
    <Tabs
      activeKey={activeGroupId || "all"}
      onChange={(key) => onGroupChange(key === "all" ? null : key)}
      items={items}
      className="mb-4"
    />
  );
}
