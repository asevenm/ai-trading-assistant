"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button, Form, Input, Card, Typography, Tabs, App } from "antd";
import { UserOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const { message } = App.useApp();

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        message.error("邮箱或密码错误");
      } else {
        message.success("登录成功");
        router.push("/");
        router.refresh();
      }
    } catch {
      message.error("登录失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: {
    email: string;
    password: string;
    name: string;
  }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        message.error(data.error || "注册失败");
        return;
      }

      message.success("注册成功，正在登录...");

      // Auto login after registration
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (!result?.error) {
        router.push("/");
        router.refresh();
      }
    } catch {
      message.error("注册失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md" variant="borderless">
        <div className="text-center mb-6">
          <Title level={2} className="!mb-2 !text-foreground">
            AI 交易助手
          </Title>
          <Text type="secondary">研究 → 交易计划 → 执行 → 复盘</Text>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          items={[
            {
              key: "login",
              label: "登录",
              children: (
                <Form
                  name="login"
                  onFinish={handleLogin}
                  layout="vertical"
                  size="large"
                >
                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: "请输入邮箱" },
                      { type: "email", message: "请输入有效的邮箱地址" },
                    ]}
                  >
                    <Input prefix={<MailOutlined />} placeholder="邮箱" />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    rules={[{ required: true, message: "请输入密码" }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="密码"
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      block
                    >
                      登录
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: "register",
              label: "注册",
              children: (
                <Form
                  name="register"
                  onFinish={handleRegister}
                  layout="vertical"
                  size="large"
                >
                  <Form.Item
                    name="name"
                    rules={[{ required: true, message: "请输入用户名" }]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="用户名" />
                  </Form.Item>

                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: "请输入邮箱" },
                      { type: "email", message: "请输入有效的邮箱地址" },
                    ]}
                  >
                    <Input prefix={<MailOutlined />} placeholder="邮箱" />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    rules={[
                      { required: true, message: "请输入密码" },
                      { min: 6, message: "密码至少6位" },
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="密码"
                    />
                  </Form.Item>

                  <Form.Item
                    name="confirmPassword"
                    dependencies={["password"]}
                    rules={[
                      { required: true, message: "请确认密码" },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue("password") === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error("两次密码不一致"));
                        },
                      }),
                    ]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="确认密码"
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      block
                    >
                      注册
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
