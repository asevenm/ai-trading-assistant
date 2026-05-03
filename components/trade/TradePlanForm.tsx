"use client";

import { useState } from "react";
import { Modal, Form, Input, InputNumber, Select, App, Button } from "antd";
import { Stock } from "@prisma/client";

const { TextArea } = Input;

interface TradePlanFormProps {
  open: boolean;
  onClose: () => void;
  stocks: Stock[];
  initialStockId?: string;
  onSuccess: () => void;
}

export function TradePlanForm({
  open,
  onClose,
  stocks,
  initialStockId,
  onSuccess,
}: TradePlanFormProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await fetch("/api/trade-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          maxPosition: (values.maxPosition as number) / 100,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        message.error(data.error || "创建失败");
        return;
      }

      message.success("交易计划已创建");
      form.resetFields();
      onSuccess();
      onClose();
    } catch {
      message.error("创建失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="新建交易计划"
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ stockId: initialStockId, maxPosition: 20 }}
      >
        <Form.Item
          name="stockId"
          label="选择股票"
          rules={[{ required: true, message: "请选择股票" }]}
        >
          <Select
            showSearch
            placeholder="搜索并选择股票"
            optionFilterProp="label"
            options={stocks.map((s) => ({
              value: s.id,
              label: `${s.name} (${s.code})`,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="entryConditions"
          label="入场条件"
          rules={[{ required: true, message: "请描述入场条件" }]}
          extra="明确你买入的理由和触发条件"
        >
          <TextArea rows={3} placeholder="如：突破前高且放量，业绩超预期..." />
        </Form.Item>

        <div className="grid grid-cols-2 gap-4">
          <Form.Item name="entryPriceMin" label="入场价格下限">
            <InputNumber className="w-full" precision={2} placeholder="最低买入价" />
          </Form.Item>
          <Form.Item name="entryPriceMax" label="入场价格上限">
            <InputNumber className="w-full" precision={2} placeholder="最高买入价" />
          </Form.Item>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Form.Item
            name="stopLoss"
            label="止损价"
            rules={[{ required: true, message: "必须设置止损" }]}
          >
            <InputNumber className="w-full" precision={2} placeholder="止损价格" />
          </Form.Item>
          <Form.Item name="takeProfit" label="止盈价">
            <InputNumber className="w-full" precision={2} placeholder="止盈价格" />
          </Form.Item>
          <Form.Item
            name="maxPosition"
            label="最大仓位(%)"
            rules={[{ required: true, message: "必须设置仓位" }]}
          >
            <InputNumber
              className="w-full"
              min={1}
              max={100}
              precision={0}
              placeholder="如：20"
            />
          </Form.Item>
        </div>

        <Form.Item
          name="disproofConditions"
          label="反证条件"
          extra="什么情况下你会认为买入逻辑被证伪"
        >
          <TextArea rows={2} placeholder="如：跌破支撑位，业绩不及预期..." />
        </Form.Item>

        <Form.Item className="mb-0 text-right">
          <Button onClick={onClose} className="mr-2">
            取消
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            创建计划
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
