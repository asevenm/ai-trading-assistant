"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Empty, Spin, Row, Col } from "antd";
import { PlusOutlined, SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import { Stock, StockGroup, Event } from "@prisma/client";
import { StockQuote } from "@/lib/stock-api";
import { useStockStore } from "@/store/useStockStore";
import { StockCard } from "@/components/dashboard/StockCard";
import { GroupTabs } from "@/components/dashboard/GroupTabs";
import { AddStockModal } from "@/components/dashboard/AddStockModal";

type StockWithRelations = Stock & {
  group?: StockGroup | null;
  events?: Event[];
};

export default function DashboardPage() {
  const router = useRouter();
  const {
    stocks,
    groups,
    activeGroupId,
    searchText,
    quotes,
    isLoading,
    setStocks,
    setGroups,
    setActiveGroup,
    setSearchText,
    updateQuotes,
    setLoading,
  } = useStockStore();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [groupsWithCount, setGroupsWithCount] = useState<
    (StockGroup & { _count?: { stocks: number } })[]
  >([]);

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stocks");
      const data: StockWithRelations[] = await res.json();
      setStocks(data);
    } catch (error) {
      console.error("Failed to fetch stocks:", error);
    } finally {
      setLoading(false);
    }
  }, [setStocks, setLoading]);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/stock-groups");
      const data = await res.json();
      setGroups(data);
      setGroupsWithCount(data);
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    }
  }, [setGroups]);

  const fetchQuotes = useCallback(async () => {
    if (stocks.length === 0) return;
    const codes = stocks.map((s) => s.code).join(",");
    try {
      const res = await fetch(`/api/stock-data?action=quotes&codes=${codes}`);
      const data: Record<string, StockQuote> = await res.json();
      updateQuotes(data);
    } catch (error) {
      console.error("Failed to fetch quotes:", error);
    }
  }, [stocks, updateQuotes]);

  useEffect(() => {
    fetchStocks();
    fetchGroups();
  }, [fetchStocks, fetchGroups]);

  useEffect(() => {
    fetchQuotes();
    const interval = setInterval(fetchQuotes, 10000);
    return () => clearInterval(interval);
  }, [fetchQuotes]);

  const filteredStocks = stocks.filter((stock) => {
    if (activeGroupId && stock.groupId !== activeGroupId) {
      return false;
    }
    if (searchText) {
      const search = searchText.toLowerCase();
      return (
        stock.name.toLowerCase().includes(search) ||
        stock.code.includes(search)
      );
    }
    return true;
  });

  const handleStockClick = (code: string) => {
    router.push(`/stock/${code}`);
  };

  const handleRefresh = () => {
    fetchStocks();
    fetchQuotes();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">自选看板</h1>
        <div className="flex gap-2">
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddModalOpen(true)}
          >
            添加股票
          </Button>
        </div>
      </div>

      <GroupTabs
        groups={groupsWithCount}
        activeGroupId={activeGroupId}
        onGroupChange={setActiveGroup}
        totalCount={stocks.length}
      />

      <div className="mb-4">
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索股票名称或代码"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          className="max-w-xs"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      ) : filteredStocks.length === 0 ? (
        <Empty
          description={stocks.length === 0 ? "暂无自选股" : "未找到匹配的股票"}
          className="py-16"
        >
          {stocks.length === 0 && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddModalOpen(true)}
            >
              添加第一只股票
            </Button>
          )}
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredStocks.map((stock) => (
            <Col key={stock.id} xs={24} sm={12} md={8} lg={6} xl={6}>
              <StockCard
                stock={stock as StockWithRelations}
                quote={quotes[stock.code]}
                onClick={() => handleStockClick(stock.code)}
              />
            </Col>
          ))}
        </Row>
      )}

      <AddStockModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        groups={groups}
        onSuccess={() => {
          fetchStocks();
          fetchGroups();
        }}
      />
    </div>
  );
}
