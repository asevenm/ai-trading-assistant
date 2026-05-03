"use client";

import { useState } from "react";
import { Button, Empty, Modal, Form, Input, App, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { ResearchNote } from "@prisma/client";
import dayjs from "dayjs";

const { TextArea } = Input;

interface ResearchNotesProps {
  stockId: string;
  notes: ResearchNote[];
  onRefresh: () => void;
}

export function ResearchNotes({ stockId, notes, onRefresh }: ResearchNotesProps) {
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ResearchNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (note: ResearchNote) => {
    setEditing(note);
    form.setFieldsValue({ content: note.content });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/research-notes/${id}`, { method: "DELETE" });
      message.success("已删除");
      onRefresh();
    } catch {
      message.error("删除失败");
    }
  };

  const handleSubmit = async (values: { content: string }) => {
    setLoading(true);
    try {
      const url = editing
        ? `/api/research-notes/${editing.id}`
        : "/api/research-notes";
      const method = editing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, stockId }),
      });

      if (!res.ok) throw new Error("Failed");

      message.success(editing ? "已更新" : "已添加");
      setModalOpen(false);
      onRefresh();
    } catch {
      message.error("保存失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="font-medium">研究笔记</span>
        <Button type="link" icon={<PlusOutlined />} onClick={handleAdd}>
          添加笔记
        </Button>
      </div>

      {notes.length === 0 ? (
        <Empty description="暂无笔记" className="py-4" />
      ) : (
        <div className="divide-y divide-border">
          {notes.map((note) => (
            <div key={note.id} className="flex items-start justify-between py-3">
              <div>
                <div className="text-foreground whitespace-pre-wrap mb-1">
                  {note.content}
                </div>
                <span className="text-xs text-muted-foreground">
                  {dayjs(note.createdAt).format("YYYY-MM-DD HH:mm")}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-4">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(note)}
                />
                <Popconfirm
                  title="确定删除？"
                  onConfirm={() => handleDelete(note.id)}
                >
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        title={editing ? "编辑笔记" : "添加笔记"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="content"
            rules={[{ required: true, message: "请输入笔记内容" }]}
          >
            <TextArea rows={6} placeholder="记录你的研究思考..." />
          </Form.Item>
          <Form.Item className="mb-0 text-right">
            <Button onClick={() => setModalOpen(false)} className="mr-2">
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
