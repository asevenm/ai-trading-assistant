"use client";

import { App, ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import { ReactNode } from "react";

export function AntdProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#3b82f6",
          colorBgContainer: "#141414",
          colorBgElevated: "#1c1c1c",
          colorBorder: "#262626",
          colorText: "#ededed",
          colorTextSecondary: "#a1a1a1",
          borderRadius: 8,
          fontFamily: "inherit",
        },
        components: {
          Layout: {
            siderBg: "#141414",
            headerBg: "#0a0a0a",
            bodyBg: "#0a0a0a",
          },
          Menu: {
            darkItemBg: "transparent",
            darkSubMenuItemBg: "#0a0a0a",
          },
          Card: {
            colorBgContainer: "#141414",
          },
          Table: {
            colorBgContainer: "#141414",
            headerBg: "#1c1c1c",
          },
          Modal: {
            contentBg: "#141414",
            headerBg: "#141414",
          },
          Input: {
            colorBgContainer: "#1c1c1c",
          },
          Select: {
            colorBgContainer: "#1c1c1c",
          },
          Button: {
            colorBgContainer: "#1c1c1c",
          },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
