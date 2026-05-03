"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, Button, Spin, Input, Modal, App } from "antd"
import { RobotOutlined, SearchOutlined } from "@ant-design/icons"
import { DeepResearch } from "@prisma/client"
import { ResearchReport } from "@/components/deep-research/ResearchReport"
import { ResearchList } from "@/components/deep-research/ResearchList"

const { Search } = Input

export default function DeepResearchPage() {
  const { message } = App.useApp()
  const [researches, setResearches] = useState<DeepResearch[]>([])
  const [selected, setSelected] = useState<DeepResearch | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<
    { code: string; name: string; market: string }[]
  >([])
  const [searching, setSearching] = useState(false)

  const fetchResearches = useCallback(async () => {
    try {
      const res = await fetch("/api/deep-research?limit=50")
      const data = await res.json()
      setResearches(data)
    } catch {
      console.error("Failed to fetch researches")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchResearches()
  }, [fetchResearches])

  const handleSearch = async (keyword: string) => {
    if (!keyword.trim()) return
    setSearching(true)
    try {
      const res = await fetch(
        `/api/stock-data?action=search&keyword=${encodeURIComponent(keyword)}`
      )
      const data = await res.json()
      setSearchResults(data)
    } catch {
      message.error("搜索失败")
    } finally {
      setSearching(false)
    }
  }

  const handleGenerate = async (code: string, name: string) => {
    setSearchModalOpen(false)
    setGenerating(true)
    try {
      const res = await fetch("/api/deep-research/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name }),
      })

      if (!res.ok) {
        const data = await res.json()
        message.error(data.error || "生成失败")
        return
      }

      const data = await res.json()
      message.success("研报已生成")
      setSelected(data)
      fetchResearches()
    } catch {
      message.error("生成失败")
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/deep-research/${id}`, { method: "DELETE" })
      message.success("已删除")
      if (selected?.id === id) setSelected(null)
      fetchResearches()
    } catch {
      message.error("删除失败")
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">深度研报</h1>
        <Button
          type="primary"
          icon={<RobotOutlined />}
          onClick={() => setSearchModalOpen(true)}
          loading={generating}
        >
          {generating ? "生成中..." : "生成研报"}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spin size="large" />
        </div>
      ) : selected ? (
        <div>
          <Button
            type="link"
            onClick={() => setSelected(null)}
            className="!px-0 mb-4"
          >
            &larr; 返回列表
          </Button>
          <Card variant="borderless">
            <ResearchReport research={selected} />
          </Card>
        </div>
      ) : (
        <Card variant="borderless">
          <ResearchList
            researches={researches}
            onSelect={setSelected}
            onDelete={handleDelete}
          />
        </Card>
      )}

      <Modal
        title="选择股票生成研报"
        open={searchModalOpen}
        onCancel={() => setSearchModalOpen(false)}
        footer={null}
        width={500}
      >
        <Search
          placeholder="输入股票代码或名称"
          onSearch={handleSearch}
          loading={searching}
          enterButton={<SearchOutlined />}
          className="mb-4"
        />

        {searchResults.map((stock) => (
          <div
            key={stock.code}
            className="flex justify-between items-center p-3 hover:bg-secondary/30 rounded cursor-pointer"
            onClick={() => handleGenerate(stock.code, stock.name)}
          >
            <div>
              <span className="font-medium">{stock.name}</span>
              <span className="text-muted-foreground ml-2">{stock.code}</span>
            </div>
            <Button type="link" size="small" icon={<RobotOutlined />}>
              生成
            </Button>
          </div>
        ))}
      </Modal>
    </div>
  )
}
