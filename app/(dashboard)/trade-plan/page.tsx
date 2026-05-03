"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, Table, Button, Tag, Space, Empty, Spin, Popconfirm, App, Tabs } from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { TradePlan, Stock, TradeLog } from "@prisma/client";
import { TradePlanForm } from "@/components/trade/TradePlanForm";
import { TradeLogForm } from "@/components/trade/TradeLogForm";
import { RiskCheckPanel } from "@/components/risk-control/RiskCheckPanel";
import { RiskSettingsPanel } from "@/components/risk-control/RiskSettingsPanel";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";

type PlanWithRelations = TradePlan & {
  stock: Stock;
  tradeLogs: TradeLog[];
};

export default function TradePlanPage() {
  const searchParams = useSearchParams();
  const stockCode = searchParams.get("stock");
  const { message } = App.useApp();
  const [plans, setPlans] = useState<PlanWithRelations[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [initialStockId, setInitialStockId] = useState<string>();
  const [riskKey, setRiskKey] = useState(0);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/trade-plans");
      const data = await res.json();
      setPlans(data);
    } catch {
      message.error("加载失败");
    } finally {
      setLoading(false);
    }
  }, [message]);

  const fetchStocks = useCallback(async () => {
    try {
      const res = await fetch("/api/stocks");
      const data = await res.json();
      setStocks(data);

      if (stockCode) {
        const stock = data.find((s: Stock) => s.code === stockCode);
        if (stock) {
          setInitialStockId(stock.id);
          setPlanModalOpen(true);
        }
      }
    } catch {
      console.error("Failed to fetch stocks");
    }
  }, [stockCode]);

  useEffect(() => {
    fetchPlans();
    fetchStocks();
  }, [fetchPlans, fetchStocks]);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/trade-plans/${id}`, { method: "DELETE" });
      message.success("已删除");
      fetchPlans();
    } catch {
      message.error("删除失败");
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await fetch(`/api/trade-plans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchPlans();
    } catch {
      message.error("更新失败");
    }
  };

  const handleLogSuccess = () => {
    fetchPlans();
    setRiskKey((prev) => prev + 1);
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    active: { label: "进行中", color: "blue" },
    executed: { label: "已执行", color: "green" },
    cancelled: { label: "已取消", color: "default" },
  };

  const columns: ColumnsType<PlanWithRelations> = [
    {
      title: "股票",
      key: "stock",
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.stock.name}</div>
          <div className="text-xs text-muted-foreground">{record.stock.code}</div>
        </div>
      ),
    },
    {
      title: "入场条件",
      dataIndex: "entryConditions",
      key: "entryConditions",
      ellipsis: true,
      width: 200,
    },
    {
      title: "止损",
      dataIndex: "stopLoss",
      key: "stopLoss",
      render: (val) => <span className="text-down">{val}</span>,
    },
    {
      title: "止盈",
      dataIndex: "takeProfit",
      key: "takeProfit",
      render: (val) => val ? <span className="text-up">{val}</span> : "-",
    },
    {
      title: "仓位",
      dataIndex: "maxPosition",
      key: "maxPosition",
      render: (val) => `${(val * 100).toFixed(0)}%`,
    },
    {
      title: "成交",
      key: "trades",
      render: (_, record) => record.tradeLogs.length,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        const info = statusMap[status] || statusMap.active;
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (val) => dayjs(val).format("MM-DD HH:mm"),
    },
    {
      title: "操作",
      key: "action",
      width: 150,
      render: (_, record) => (
        <Space>
          {record.status === "active" && (
            <Button
              size="small"
              onClick={() => handleStatusChange(record.id, "executed")}
            >
              完成
            </Button>
          )}
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const activePlans = plans.filter((p) => p.status === "active");

  const tabItems = [
    {
      key: "plans",
      label: "交易计划",
      children: (
        <div>
          <div className="flex justify-end mb-4">
            <Space>
              <Button
                icon={<PlusOutlined />}
                onClick={() => setLogModalOpen(true)}
                disabled={activePlans.length === 0}
              >
                记录成交
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setInitialStockId(undefined);
                  setPlanModalOpen(true);
                }}
              >
                新建计划
              </Button>
            </Space>
          </div>

          <Card variant="borderless">
            {loading ? (
              <div className="flex justify-center py-16">
                <Spin size="large" />
              </div>
            ) : plans.length === 0 ? (
              <Empty description="暂无交易计划" className="py-16">
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setPlanModalOpen(true)}
                >
                  创建第一个计划
                </Button>
              </Empty>
            ) : (
              <Table
                dataSource={plans}
                columns={columns}
                rowKey="id"
                pagination={{ pageSize: 10 }}
              />
            )}
          </Card>
        </div>
      ),
    },
    {
      key: "risk",
      label: (
        <span>
          <SafetyCertificateOutlined className="mr-1" />
          风控监控
        </span>
      ),
      children: <RiskCheckPanel key={riskKey} />,
    },
    {
      key: "settings",
      label: (
        <span>
          <SettingOutlined className="mr-1" />
          风控设置
        </span>
      ),
      children: (
        <RiskSettingsPanel
          onSaved={() => setRiskKey((prev) => prev + 1)}
        />
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">交易计划 & 风控</h1>
      </div>

      <Tabs items={tabItems} defaultActiveKey="plans" />

      <TradePlanForm
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        stocks={stocks}
        initialStockId={initialStockId}
        onSuccess={fetchPlans}
      />

      <TradeLogForm
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        plans={activePlans}
        onSuccess={handleLogSuccess}
      />
    </div>
  );
}
