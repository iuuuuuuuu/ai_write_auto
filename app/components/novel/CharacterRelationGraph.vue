<script setup lang="ts">
const props = defineProps<{
  characters: Array<{
    id: number
    name: string
    description: string | null
    appearances: Array<{ chapterId: number }>
  }>
}>()

const svgRef = ref<SVGSVGElement | null>(null)
const containerSize = reactive({ width: 600, height: 400 })

interface GraphNode {
  id: number
  name: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
}

interface GraphEdge {
  source: number
  target: number
  strength: number
}

const colors = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#f97316',
  '#6366f1'
]

function getNodeColor(index: number) {
  return colors[index % colors.length]
}

function computeEdges() {
  const chapterToChars = new Map<number, Set<number>>()
  for (const char of props.characters) {
    for (const app of char.appearances) {
      if (!chapterToChars.has(app.chapterId)) {
        chapterToChars.set(app.chapterId, new Set())
      }
      chapterToChars.get(app.chapterId)!.add(char.id)
    }
  }

  const cooccurrence = new Map<string, number>()
  for (const charIds of chapterToChars.values()) {
    const ids = Array.from(charIds)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${Math.min(ids[i], ids[j])}-${Math.max(ids[i], ids[j])}`
        cooccurrence.set(key, (cooccurrence.get(key) || 0) + 1)
      }
    }
  }

  const edges: GraphEdge[] = []
  for (const [key, strength] of cooccurrence) {
    const [source, target] = key.split('-').map(Number)
    edges.push({ source, target, strength })
  }
  return edges
}

function initNodes(): GraphNode[] {
  return props.characters.map((char, index) => ({
    id: char.id,
    name: char.name,
    x: containerSize.width / 2 + (Math.random() - 0.5) * 100,
    y: containerSize.height / 2 + (Math.random() - 0.5) * 100,
    vx: 0,
    vy: 0,
    radius: Math.max(20, 12 + char.appearances.length * 2),
    color: getNodeColor(index)
  }))
}

function simulate(nodes: GraphNode[], edges: GraphEdge[]) {
  const iterations = 120
  const width = containerSize.width
  const height = containerSize.height

  for (let iter = 0; iter < iterations; iter++) {
    // 斥力
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x
        const dy = nodes[j].y - nodes[i].y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = 3000 / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        nodes[i].vx -= fx
        nodes[i].vy -= fy
        nodes[j].vx += fx
        nodes[j].vy += fy
      }
    }

    // 引力
    for (const edge of edges) {
      const source = nodes.find((n) => n.id === edge.source)
      const target = nodes.find((n) => n.id === edge.target)
      if (!source || !target) continue
      const dx = target.x - source.x
      const dy = target.y - source.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = dist * 0.008 * Math.min(edge.strength, 5)
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      source.vx += fx
      source.vy += fy
      target.vx -= fx
      target.vy -= fy
    }

    // 中心引力
    for (const node of nodes) {
      const dx = width / 2 - node.x
      const dy = height / 2 - node.y
      node.vx += dx * 0.003
      node.vy += dy * 0.003
    }

    // 更新位置
    for (const node of nodes) {
      node.vx *= 0.6
      node.vy *= 0.6
      node.x += node.vx
      node.y += node.vy
      node.x = Math.max(node.radius, Math.min(width - node.radius, node.x))
      node.y = Math.max(node.radius, Math.min(height - node.radius, node.y))
    }
  }
}

const nodes = ref<GraphNode[]>([])
const edges = ref<GraphEdge[]>([])
const hoveredNodeId = ref<number | null>(null)

function computeLayout() {
  if (!props.characters.length) return
  edges.value = computeEdges()
  const newNodes = initNodes()
  simulate(newNodes, edges.value)
  nodes.value = newNodes
}

function updateSize() {
  if (!svgRef.value) return
  const rect = svgRef.value.getBoundingClientRect()
  containerSize.width = rect.width
  containerSize.height = rect.height
}

const connectedNodeIds = computed(() => {
  if (hoveredNodeId.value === null) return new Set<number>()
  const connected = new Set<number>([hoveredNodeId.value])
  for (const edge of edges.value) {
    if (edge.source === hoveredNodeId.value) connected.add(edge.target)
    if (edge.target === hoveredNodeId.value) connected.add(edge.source)
  }
  return connected
})

const filteredEdges = computed(() => {
  if (hoveredNodeId.value === null) return edges.value
  return edges.value.filter(
    (edge) =>
      edge.source === hoveredNodeId.value || edge.target === hoveredNodeId.value
  )
})

onMounted(() => {
  updateSize()
  computeLayout()
  window.addEventListener('resize', () => {
    updateSize()
    computeLayout()
  })
})

watch(
  () => props.characters.map((c) => c.id),
  () => {
    nextTick(() => {
      updateSize()
      computeLayout()
    })
  },
  { deep: true }
)
</script>

<template>
  <div class="relative w-full h-full min-h-[320px]">
    <svg
      v-if="nodes.length"
      ref="svgRef"
      class="w-full h-full"
      :viewBox="`0 0 ${containerSize.width} ${containerSize.height}`"
    >
      <!-- Edges -->
      <line
        v-for="edge in filteredEdges"
        :key="`${edge.source}-${edge.target}`"
        :x1="nodes.find((n) => n.id === edge.source)?.x"
        :y1="nodes.find((n) => n.id === edge.source)?.y"
        :x2="nodes.find((n) => n.id === edge.target)?.x"
        :y2="nodes.find((n) => n.id === edge.target)?.y"
        :stroke="
          hoveredNodeId !== null ?
            'currentColor'
          : 'var(--ui-border)'
        "
        :stroke-width="Math.min(edge.strength, 4)"
        :opacity="hoveredNodeId !== null ? 0.6 : 0.3"
        class="text-(--ui-text-dimmed)"
      />

      <!-- Nodes -->
      <g
        v-for="node in nodes"
        :key="node.id"
        class="cursor-pointer transition-opacity duration-200"
        :class="
          hoveredNodeId !== null && !connectedNodeIds.has(node.id) ?
            'opacity-30'
          : 'opacity-100'
        "
        @mouseenter="hoveredNodeId = node.id"
        @mouseleave="hoveredNodeId = null"
      >
        <circle
          :cx="node.x"
          :cy="node.y"
          :r="node.radius"
          :fill="node.color + '20'"
          :stroke="node.color"
          stroke-width="2"
        />
        <text
          :x="node.x"
          :y="node.y"
          text-anchor="middle"
          dominant-baseline="central"
          class="text-[11px] select-none"
          :fill="node.color"
        >
          {{ node.name.length > 3 ? node.name.slice(0, 2) + '..' : node.name }}
        </text>
        <title>{{ node.name }}（出场 {{ props.characters.find(c => c.id === node.id)?.appearances.length || 0 }} 章）</title>
      </g>
    </svg>

    <div
      v-else
      class="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 text-sm text-(--ui-text-muted)"
    >
      <Icon
        icon="lucide:users"
        class="size-8 opacity-40"
      />
      <p>角色数量不足，无法生成关系图</p>
    </div>

    <!-- Legend -->
    <div
      v-if="nodes.length"
      class="absolute bottom-2 right-2 rounded-md bg-(--ui-bg-muted)/80 backdrop-blur-sm px-2 py-1 text-[10px] text-(--ui-text-dimmed)"
    >
      节点大小 = 出场次数 · 连线粗细 = 共现次数
    </div>
  </div>
</template>
