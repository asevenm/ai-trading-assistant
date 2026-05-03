"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, Form, InputNumber, Button, App, Spin } from "antd"
import { SettingOutlined } from "@ant-design/icons"
import type { RiskSettings } from "@prisma/client"

interface RiskSettingsPanelProps {
  onSaved?: () => void
}

export function RiskSettingsPanel({ onSaved }: RiskSettingsPanelProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/risk-control/settings")
      if (!res.ok) throw new Error("Failed")
      const data: RiskSettings = await res.json()
      form.setFieldsValue({
        totalCapital: data.totalCapital,
        maxDailyLoss: data.maxDailyLoss,
        maxConsecutiveLoss: data.maxConsecutiveLoss,
        maxSinglePosition: data.maxSinglePosition,
        maxTotalPosition: data.maxTotalPosition,
      })
    } catch {
      message.error("加载风控设置失败")
    } finally {
      setLoading(false)
    }
  }, [form, message])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch("/api/risk-control/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error("Failed")
      message.success("风控设置已保存")
      onSaved?.()
    } catch {
      message.error("保存失败")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card variant="borderless">
        <div className="flex justify-center py-8">
          <Spin />
        </div>
      </Card>
    )
  }

  return (
    <Card
      title={
        <span>
          <SettingOutlined className="mr-2" />
          风控参数设置
        </span>
      }
      variant="borderless"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
      >
        <div className="grid grid-cols-2 gap-x-6">
          <Form.Item
            name="totalCapital"
            label="总资金(元)"
            rules={[{ required: true, message: "请输入总资金" }]}
          >
            <InputNumber
              className="w-full"
              min={1000}
              precision={0}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            />
          </Form.Item>

          <Form.Item
            name="maxDailyLoss"
            label="单日最大亏损(%)"
            rules={[{ required: true, message: "请设置" }]}
            extra="超过此百分比将触发预警"
          >
            <InputNumber className="w-full" min={0.5} max={20} precision={1} />
          </Form.Item>

          <Form.Item
            name="maxConsecutiveLoss"
            label="连续亏损预警(次)"
            rules={[{ required: true, message: "请设置" }]}
            extra="连亏达此次数建议休息"
          >
            <InputNumber className="w-full" min={1} max={20} precision={0} />
          </Form.Item>

          <Form.Item
            name="maxSinglePosition"
            label="单票最大仓位(%)"
            rules={[{ required: true, message: "请设置" }]}
          >
            <InputNumber className="w-full" min={5} max={100} precision={0} />
          </Form.Item>

          <Form.Item
            name="maxTotalPosition"
            label="最大总仓位(%)"
            rules={[{ required: true, message: "请设置" }]}
          >
            <InputNumber className="w-full" min={10} max={100} precision={0} />
          </Form.Item>
        </div>

        <div className="text-right">
          <Button type="primary" htmlType="submit" loading={saving}>
            保存设置
          </Button>
        </div>
      </Form>
    </Card>
  )
}
