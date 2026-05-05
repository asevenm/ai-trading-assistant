"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Layout, Menu, Button, Avatar, Dropdown, Typography } from "antd";
import {
  DashboardOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  FileSearchOutlined,
  RiseOutlined,
  FundOutlined,
  RobotOutlined,
  DashboardFilled,
  AlertOutlined,
  SafetyCertificateOutlined,
  TrophyOutlined,
  RadarChartOutlined,
  RocketOutlined,
  ExperimentOutlined,
  NotificationOutlined,
  FireOutlined,
  ClockCircleOutlined,
  MoonOutlined,
  AimOutlined,
  ReadOutlined,
} from "@ant-design/icons";
import { AlertBell } from "@/components/alerts/AlertBell";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  {
    key: "/",
    icon: <DashboardOutlined />,
    label: "自选看板",
  },
  {
    key: "group-pre-market",
    icon: <ClockCircleOutlined />,
    label: "盘前",
    children: [
      { key: "/morning-brief", icon: <RobotOutlined />, label: "盘前计划" },
      { key: "/auction", icon: <ClockCircleOutlined />, label: "集合竞价" },
    ],
  },
  {
    key: "group-limit-up",
    icon: <RiseOutlined />,
    label: "涨停生态",
    children: [
      { key: "/live-trading", icon: <ThunderboltOutlined />, label: "盘中作战" },
      { key: "/limit-up", icon: <RiseOutlined />, label: "涨停分析" },
      { key: "/pre-limit-up", icon: <RocketOutlined />, label: "预涨停雷达" },
      { key: "/seal-order", icon: <SafetyCertificateOutlined />, label: "封单&打板" },
    ],
  },
  {
    key: "group-discovery",
    icon: <AimOutlined />,
    label: "潜力发现",
    children: [
      { key: "/cousins-radar", icon: <RadarChartOutlined />, label: "兄弟股雷达" },
      { key: "/dormant", icon: <MoonOutlined />, label: "蛰伏股扫描" },
      { key: "/theme-radar", icon: <RadarChartOutlined />, label: "题材雷达" },
      { key: "/rotation-live", icon: <ThunderboltOutlined />, label: "轮动实时" },
      { key: "/stock-screen", icon: <ThunderboltOutlined />, label: "趋势选股" },
    ],
  },
  {
    key: "group-capital",
    icon: <FundOutlined />,
    label: "资金·情绪",
    children: [
      { key: "/market-sentiment", icon: <DashboardFilled />, label: "情绪仪表盘" },
      { key: "/sector-flow", icon: <FundOutlined />, label: "资金流向" },
      { key: "/billboard", icon: <TrophyOutlined />, label: "龙虎榜" },
      { key: "/hot-money", icon: <FireOutlined />, label: "游资追踪" },
    ],
  },
  {
    key: "group-research",
    icon: <ReadOutlined />,
    label: "信息研究",
    children: [
      { key: "/news-intel", icon: <NotificationOutlined />, label: "消息雷达" },
      { key: "/deep-research", icon: <FileSearchOutlined />, label: "深度研报" },
      { key: "/dna-match", icon: <ExperimentOutlined />, label: "K线DNA" },
    ],
  },
  {
    key: "group-alerts",
    icon: <AlertOutlined />,
    label: "异动告警",
    children: [
      { key: "/alerts", label: "A股异动" },
      { key: "/alerts/hk", label: "港股异动" },
    ],
  },
  {
    key: "group-review",
    icon: <BarChartOutlined />,
    label: "复盘·校准",
    children: [
      { key: "/daily-review", icon: <BarChartOutlined />, label: "每日复盘" },
      { key: "/promotion-backtest", icon: <ExperimentOutlined />, label: "进阶概率回测" },
    ],
  },
];

const PATH_TO_GROUP: Record<string, string> = {
  "/morning-brief": "group-pre-market",
  "/auction": "group-pre-market",
  "/limit-up": "group-limit-up",
  "/live-trading": "group-limit-up",
  "/pre-limit-up": "group-limit-up",
  "/seal-order": "group-limit-up",
  "/cousins-radar": "group-discovery",
  "/dormant": "group-discovery",
  "/theme-radar": "group-discovery",
  "/rotation-live": "group-discovery",
  "/stock-screen": "group-discovery",
  "/market-sentiment": "group-capital",
  "/sector-flow": "group-capital",
  "/billboard": "group-capital",
  "/hot-money": "group-capital",
  "/news-intel": "group-research",
  "/deep-research": "group-research",
  "/dna-match": "group-research",
  "/daily-review": "group-review",
  "/promotion-backtest": "group-review",
};

function getOpenGroup(pathname: string): string[] {
  if (pathname.startsWith("/alerts")) return ["group-alerts"];
  return PATH_TO_GROUP[pathname] ? [PATH_TO_GROUP[pathname]] : [];
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  const handleMenuClick = ({ key }: { key: string }) => {
    router.push(key);
  };

  const userMenuItems = [
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录",
      onClick: () => signOut({ callbackUrl: "/login" }),
    },
  ];

  const siderWidth = collapsed ? 80 : 200;

  return (
    <Layout className="h-screen overflow-hidden">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        className="!bg-card border-r border-border !fixed !left-0 !top-0 !bottom-0 z-20 !h-screen"
        width={200}
      >
        <div className="h-16 flex items-center justify-center border-b border-border shrink-0">
          <Text strong className="!text-lg !text-foreground">
            {collapsed ? "AI" : "AI 交易助手"}
          </Text>
        </div>
        <div className="overflow-y-auto" style={{ height: "calc(100vh - 4rem)" }}>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[pathname]}
            defaultOpenKeys={getOpenGroup(pathname)}
            items={menuItems}
            onClick={handleMenuClick}
            className="border-none"
          />
        </div>
      </Sider>
      <Layout style={{ marginLeft: siderWidth, transition: "margin-left 0.2s" }}>
        <Header className="!bg-card !px-4 flex items-center justify-between border-b border-border">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className="!text-foreground"
          />
          <div className="flex items-center gap-3">
            <AlertBell />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div className="flex items-center gap-2 cursor-pointer hover:opacity-80">
                <Avatar icon={<UserOutlined />} size="small" />
                <Text className="!text-foreground">
                  {session?.user?.name || session?.user?.email}
                </Text>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content className="p-6 overflow-auto">{children}</Content>
      </Layout>
    </Layout>
  );
}
