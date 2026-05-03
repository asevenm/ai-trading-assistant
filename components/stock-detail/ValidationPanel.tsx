"use client";

import { useState } from "react";
import {
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  App,
  Popconfirm,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { ValidationIndicator } from "@prisma/client";
import type { ColumnsType } from "antd/es/table";

interface ValidationPanelProps {
  stockId: string;
  indicators: ValidationIndicator[];
  onRefresh: () => void;
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "待验证", color: "default" },
  validated: { label: "已验证", color: "green" },
  disproved: { label: "已证伪", color: "red" },
};

export function ValidationPanel({
  stockId,
  indicators,
  onRefresh,
}: ValidationPanelProps) {
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ValidationIndicator | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: ValidationIndicator) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/validation-indicators/${id}`, { method: "DELETE" });
      message.success("已删除");
      onRefresh();
    } catch {
      message.error("删除失败");
    }
  };

  const handleSubmit = async (values: Partial<ValidationIndicator>) => {
    setLoading(true);
    try {
      const url = editing
        ? `/api/validation-indicators/${editing.id}`
        : "/api/validation-indicators";
      const method = editing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, stockId }),
      });

      if (!res.ok) {
        throw new Error("Failed to save");
      }

      message.success(editing ? "已更新" : "已添加");
      setModalOpen(false);
      onRefresh();
    } catch {
      message.error("保存失败");
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<ValidationIndicator> = [
    {
      title: "指标",
      dataIndex: "indicator",
      key: "indicator",
    },
    {
      title: "目标值",
      dataIndex: "targetValue",
      key: "targetValue",
      render: (val) => val || "-",
    },
    {
      title: "当前值",
      dataIndex: "currentValue",
      key: "currentValue",
      render: (val) => val || "-",
    },
    {
      title: "证伪条件",
      dataIndex: "disproofCondition",
      key: "disproofCondition",
      render: (val) => val || "-",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        const info = statusMap[status] || statusMap.pending;
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: "操作",
      key: "action",
      width: 100,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="确定删除？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="font-medium">验证指标</span>
        <Button type="link" icon={<PlusOutlined />} onClick={handleAdd}>
          添加指标
        </Button>
      </div>

      <Table
        dataSource={indicators}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        className="table-compact"
      />

      <Modal
        title={editing ? "编辑指标" : "添加指标"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="indicator"
            label="指标名称"
            rules={[{ required: true, message: "请输入指标名称" }]}
          >
            <Input placeholder="如：月度销量、毛利率" />
          </Form.Item>

          <Form.Item name="targetValue" label="目标值">
            <Input placeholder="预期达到的值" />
          </Form.Item>

          <Form.Item name="currentValue" label="当前值">
            <Input placeholder="当前实际值" />
          </Form.Item>

          <Form.Item name="disproofCondition" label="证伪条件">
            <Input.TextArea
              rows={2}
              placeholder="什么情况下认为逻辑被证伪"
            />
          </Form.Item>

          <Form.Item name="status" label="状态" initialValue="pending">
            <Select
              options={Object.entries(statusMap).map(([key, val]) => ({
                value: key,
                label: val.label,
              }))}
            />
          </Form.Item>

          <Form.Item className="mb-0 text-right">
            <Space>
              <Button onClick={() => setModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
