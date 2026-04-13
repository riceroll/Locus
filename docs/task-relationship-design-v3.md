# Task Relationship Design v3

## 核心概念

任务之间有两种完全独立的 edge（关系）：

### 1. 分解关系（parent_id）— 树结构

- **语义**：A 包含 B，B 是 A 的子任务
- **数据**：`tasks.parent_id` → 自引用外键
- **约束**：树结构，一个任务只有一个 parent，不能成环
- **深度**：最多 3 层（task → subtask → sub-subtask）
- **例子**：
  ```
  吃饭
  ├── 吃蔬菜
  ├── 吃荤菜（吃牛排）
  └── 吃主食
  ```

### 2. 依赖关系（depends_on_id）— DAG

- **语义**：B depends on A = A 完成了 B 才能开始
- **数据**：`tasks.depends_on_id` → 自引用外键（目前单链，未来可扩展为多对多联结表）
- **约束**：有向无环图（DAG），不能成环，**可以跨树**
- **例子**：
  ```
  洗餐具
  └── 洗刀叉  ──depends on──→  吃牛排（属于"吃饭"的子任务）
  ```

两者互不干扰。一个任务可以既是某个 parent 的子任务，又依赖于完全不同树下的另一个任务。

## Effort 模型

- 每个任务有 `estimate`（自身 effort）
- 一个任务 decompose（有子任务）之后，自身 estimate 可以设为 0 或保留
- Total effort = 自身 estimate + Σ 子任务 total effort（递归）
- 不需要区分"有 effort 的 node"和"没 effort 的 node"——就是 estimate 为 0 或非 0 的区别

## "可执行任务" 的定义

一个任务在 Kanban 上显示 = 当前可以去做的事情，必须同时满足：

1. **是叶子节点**：没有子任务，OR 所有子任务已完成
2. **未被阻塞**：`depends_on_id` 为空，OR 所指向的任务已完成
3. **自身未完成**

换言之：如果"吃饭"已经 decompose 成三个子任务，Kanban 不显示"吃饭"，只显示那三个子任务中可执行的。

## 各 View 的职责

| View | 展示内容 | 关系展示 |
|------|---------|---------|
| **ListView** | 完整任务树、所有层级 | 树结构（缩进）；同级链（amber 边框）；跨树依赖（小 tag: `blocked by: X`，点击跳转） |
| **KanbanView** | 只显示"可执行任务" | 不显示结构关系；blocked 任务不出现或灰显 |
| **TaskDetailModal** | 单个任务详情 | 子任务列表；"Blocked by" 选择器（允许选任何未完成任务）；"Blocks" 反向列表 |
| **GraphView**（未来） | 完整依赖图 | 节点 + 箭头，DAG 可视化 |

## 对现有代码的改动

### 已完成

- [x] `parent_id` 环检测（`wouldCycleParent`）
- [x] `depends_on_id` 环检测（`wouldCycleDepends`）
- [x] `updateTask` 关系字段守卫（cycle + cross-parent 校验）
- [x] `deleteTask` 重新设计：子任务 reparent 到 grandparent，chain heal
- [x] `deleteTaskRecursive` 递归删除
- [x] `repairRelationships` 启动修复
- [x] 删除确认双选项（keep subtasks / delete all）

### 待实施

- [ ] 去掉 `depends_on_id` 的 same-parent 限制
- [ ] KanbanView 改为只显示"可执行任务"
- [ ] TaskDetailModal "Blocked by" 允许选任何未完成任务
- [ ] TaskDetailModal 显示 "Blocks: ..." 反向关系
- [ ] ListView 跨树依赖显示小 tag（`blocked by: X`）
- [ ] （未来）GraphView — DAG 可视化
- [ ] （未来）`depends_on_id` 扩展为多对多联结表 `task_dependencies(from_task_id, to_task_id)`

## 方向性约定

- `depends_on_id` 的含义：**我要等它完成** → `B.depends_on_id = A` 表示 B 等 A
- 从 A 的视角：A blocks B
- 从 B 的视角：B depends on A / B is blocked by A
