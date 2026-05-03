"use client";

import { useState } from "react";
import { Modal, Form, InputNumber, Select, Input, DatePicker, App, Button } from "antd";
import { TradePlan, Stock } from "@prisma/client";
import dayjs from "dayjs";

const { TextArea } = Input;

interface TradeLogFormProps {
  open: boolean;
  onClose: () => void;
  plans: (TradePlan & { stock: Stock })[];
  initialPlanId?: string;
  onSuccess: () => void;
}

const entryReasons = [
  "业绩事件",
  "突破买入",
  "回调买入",
  "追涨买入",
  "底部反转",
  "技术形态",
  "资金流入",
  "其他",
];

const exitReasons = [
  "止盈卖出",
  "止损卖出",
  "计划到期",
  "逻辑证伪",
  "仓位调整",
  "其他",
];

export function TradeLogForm({
  open,
  onClose,
  plans,
  initialPlanId,
  onSuccess,
}: TradeLogFormProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const tradeType = Form.useWatch("type", form);

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await fetch("/api/trade-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          tradeTime: values.tradeTime ? (values.tradeTime as dayjs.Dayjs).toISOString() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        message.error(data.error || "记录失败");
        return;
      }

      message.success("交易已记录");
      form.resetFields();
      onSuccess();
      onClose();
    } catch {
      message.error("记录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="记录交易"
      open={open}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          tradePlanId: initialPlanId,
          type: "buy",
          tradeTime: dayjs(),
        }}
      >
        <Form.Item
          name="tradePlanId"
          label="交易计划"
          rules={[{ required: true, message: "请选择交易计划" }]}
          extra="只有创建了交易计划才能记录成交"
        >
          <Select
            placeholder="选择交易计划"
            options={plans.map((p) => ({
              value: p.id,
              label: `${p.stock.name} (${p.stock.code})`,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="type"
          label="交易类型"
          rules={[{ required: true }]}
        >
          <Select
            options={[
              { value: "buy", label: "买入" },
              { value: "sell", label: "卖出" },
            ]}
          />
        </Form.Item>

        <div className="grid grid-cols-2 gap-4">
          <Form.Item
            name="quantity"
            label="数量(股)"
            rules={[{ required: true, message: "请输入数量" }]}
          >
            <InputNumber className="w-full" min={1} precision={0} />
          </Form.Item>
          <Form.Item
            name="price"
            label="成交价"
            rules={[{ required: true, message: "请输入价格" }]}
          >
            <InputNumber className="w-full" min={0} precision={2} />
          </Form.Item>
        </div>

        <Form.Item name="tradeTime" label="成交时间">
          <DatePicker showTime className="w-full" />
        </Form.Item>

        {tradeType === "buy" ? (
          <Form.Item
            name="entryReason"
            label="买入理由"
            rules={[{ required: true, message: "必须填写买入理由（风控要求）" }]}
            extra="风控要求：每笔买入必须记录理由"
          >
            <Select
              placeholder="选择买入理由"
              options={entryReasons.map((r) => ({ value: r, label: r }))}
            />
          </Form.Item>
        ) : (
          <>
            <Form.Item name="exitReason" label="卖出理由">
              <Select
                allowClear
                placeholder="选择卖出理由"
                options={exitReasons.map((r) => ({ value: r, label: r }))}
              />
            </Form.Item>
            <Form.Item name="realizedPnL" label="实现盈亏">
              <InputNumber className="w-full" precision={2} placeholder="盈利为正，亏损为负" />
            </Form.Item>
            <Form.Item name="resultTag" label="结果标签">
              <Select
                allowClear
                options={[
                  { value: "success", label: "成功" },
                  { value: "failure", label: "失败" },
                  { value: "partial", label: "部分成功" },
                ]}
              />
            </Form.Item>
          </>
        )}

        <Form.Item name="notes" label="备注">
          <TextArea rows={2} placeholder="交易备注..." />
        </Form.Item>

        <Form.Item className="mb-0 text-right">
          <Button onClick={onClose} className="mr-2">
            取消
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            记录
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
