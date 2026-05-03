"use client";

import { useState } from "react";
import {
  Modal,
  Input,
  Typography,
  Spin,
  Empty,
  Select,
  App,
} from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useDebounceFn } from "ahooks";
import { StockGroup } from "@prisma/client";
import { StockInfo } from "@/lib/stock-api";
import { useStockStore } from "@/store/useStockStore";

const { Text } = Typography;

interface AddStockModalProps {
  open: boolean;
  onClose: () => void;
  groups: StockGroup[];
  onSuccess: () => void;
}

export function AddStockModal({
  open,
  onClose,
  groups,
  onSuccess,
}: AddStockModalProps) {
  const { message } = App.useApp();
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);

  const { addStock } = useStockStore();

  const searchStock = async (value: string) => {
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/stock-data?action=search&keyword=${encodeURIComponent(value)}`
      );
      const data = await res.json();
      setSearchResults(data);
    } catch {
      message.error("搜索失败");
    } finally {
      setLoading(false);
    }
  };

  const { run: handleSearch } = useDebounceFn(searchStock, {
    wait: 500,
  });

  const handleAdd = async (stock: StockInfo) => {
    setAdding(true);
    try {
      const res = await fetch("/api/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: stock.code,
          name: stock.name,
          market: stock.market,
          groupId: selectedGroup,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        message.error(data.error || "添加失败");
        return;
      }

      const newStock = await res.json();
      addStock(newStock);
      message.success(`已添加 ${stock.name}`);
      onSuccess();
      handleClose();
    } catch {
      message.error("添加失败");
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    setSearchText("");
    setSearchResults([]);
    setSelectedGroup(undefined);
    onClose();
  };

  return (
    <Modal
      title="添加自选股"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={500}
    >
      <div className="space-y-4">
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索股票代码或名称"
          value={searchText}
          onChange={(e) => {
            const value = e.target.value;
            setSearchText(value);
            handleSearch(value);
          }}
          allowClear
          size="large"
        />

        <Select
          placeholder="选择分组（可选）"
          value={selectedGroup}
          onChange={setSelectedGroup}
          allowClear
          className="w-full"
          options={groups.map((g) => ({
            label: g.name,
            value: g.id,
          }))}
        />

        <div className="min-h-[200px]">
          {loading ? (
            <div className="flex justify-center items-center h-[200px]">
              <Spin />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="divide-y divide-border">
              {searchResults.map((item) => (
                <div
                  key={item.code}
                  className="flex justify-between w-full cursor-pointer hover:bg-secondary/50 px-2 py-3 rounded"
                  onClick={() => !adding && handleAdd(item)}
                >
                  <div>
                    <Text strong>{item.name}</Text>
                    <Text type="secondary" className="ml-2">
                      {item.code}
                    </Text>
                  </div>
                  <Text type="secondary">{item.market}</Text>
                </div>
              ))}
            </div>
          ) : searchText ? (
            <Empty description="未找到相关股票" className="py-10" />
          ) : (
            <Empty description="输入股票代码或名称搜索" className="py-10" />
          )}
        </div>
      </div>
    </Modal>
  );
}
