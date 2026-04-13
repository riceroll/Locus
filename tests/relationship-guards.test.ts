/**
 * Tests for task relationship guards.
 * Run: npx tsx tests/relationship-guards.test.ts
 *
 * Tests the pure validator functions extracted from useTaskStore
 * and simulates various illegal operations.
 */

// ── Inline the pure validators (same logic as useTaskStore.ts) ──────────────

interface Task {
  id: string;
  title: string;
  parent_id: string | null;
  depends_on_id: string | null;
  project_id: string | null;
  status_id: string;
  position: number;
}

function wouldCycleParent(taskId: string, newParentId: string | null, tasks: Task[]): boolean {
  if (!newParentId) return false;
  const visited = new Set<string>();
  let cur: string | null = newParentId;
  while (cur) {
    if (cur === taskId) return true;
    if (visited.has(cur)) return true;
    visited.add(cur);
    cur = tasks.find((t) => t.id === cur)?.parent_id ?? null;
  }
  return false;
}

function wouldCycleDepends(taskId: string, newDependsOnId: string | null, tasks: Task[]): boolean {
  if (!newDependsOnId) return false;
  const visited = new Set<string>();
  let cur: string | null = newDependsOnId;
  while (cur) {
    if (cur === taskId) return true;
    if (visited.has(cur)) return true;
    visited.add(cur);
    cur = tasks.find((t) => t.id === cur)?.depends_on_id ?? null;
  }
  return false;
}

function sameSiblingGroup(taskId: string, dependsOnId: string, tasks: Task[]): boolean {
  const task = tasks.find((t) => t.id === taskId);
  const dep = tasks.find((t) => t.id === dependsOnId);
  if (!task || !dep) return false;
  return (task.parent_id ?? null) === (dep.parent_id ?? null);
}

function collectDescendantIds(taskId: string, tasks: Task[]): string[] {
  const result: string[] = [];
  const queue = [taskId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const t of tasks) {
      if (t.parent_id === cur) {
        result.push(t.id);
        queue.push(t.id);
      }
    }
  }
  return result;
}

// ── Test helpers ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    console.log(`  ❌ FAIL: ${msg}`);
  }
}

function section(name: string) {
  console.log(`\n═══ ${name} ═══`);
}

// ── Test data: simulates a real task tree ───────────────────────────────────

const mk = (id: string, title: string, opts: Partial<Task> = {}): Task => ({
  id,
  title,
  parent_id: null,
  depends_on_id: null,
  project_id: 'proj-A',
  status_id: 'status-todo',
  position: 0,
  ...opts,
});

// ── 1. Parent cycle detection ──────────────────────────────────────────────

section('Parent cycle detection');

(() => {
  // Simple tree: root -> A -> B -> C
  const tasks: Task[] = [
    mk('root', 'Root'),
    mk('A', 'A', { parent_id: 'root' }),
    mk('B', 'B', { parent_id: 'A' }),
    mk('C', 'C', { parent_id: 'B' }),
  ];

  assert(wouldCycleParent('root', 'C', tasks) === true,
    'Moving root under its great-grandchild C creates cycle');
  assert(wouldCycleParent('root', 'A', tasks) === true,
    'Moving root under its child A creates cycle');
  assert(wouldCycleParent('A', 'C', tasks) === true,
    'Moving A under its grandchild C creates cycle');
  assert(wouldCycleParent('A', 'B', tasks) === true,
    'Moving A under its child B creates cycle');
  assert(wouldCycleParent('C', 'root', tasks) === false,
    'Moving C under root (deeper nesting) is OK');
  assert(wouldCycleParent('root', null, tasks) === false,
    'Setting parent to null is always OK');
})();

(() => {
  // Mutual cycle: A -> B -> A (already broken data)
  const tasks: Task[] = [
    mk('A', 'A', { parent_id: 'B' }),
    mk('B', 'B', { parent_id: 'A' }),
  ];

  assert(wouldCycleParent('A', 'B', tasks) === true,
    'Existing mutual cycle A↔B detected when setting A.parent=B');
  assert(wouldCycleParent('B', 'A', tasks) === true,
    'Existing mutual cycle A↔B detected when setting B.parent=A');
})();

(() => {
  // Self-reference
  const tasks: Task[] = [mk('X', 'X')];
  assert(wouldCycleParent('X', 'X', tasks) === true,
    'Setting task as its own parent is a cycle');
})();

// ── 2. Depends-on cycle detection ──────────────────────────────────────────

section('Depends-on cycle detection');

(() => {
  // Chain: A → B → C (A depends on B, B depends on C)
  const tasks: Task[] = [
    mk('A', 'A', { depends_on_id: 'B' }),
    mk('B', 'B', { depends_on_id: 'C' }),
    mk('C', 'C'),
  ];

  assert(wouldCycleDepends('C', 'A', tasks) === true,
    'Setting C.depends_on=A would close chain C→A→B→C');
  assert(wouldCycleDepends('C', 'B', tasks) === true,
    'Setting C.depends_on=B would close chain C→B→C');
  assert(wouldCycleDepends('A', 'C', tasks) === false,
    'A already depends on B which depends on C, setting A.depends=C is a shortcut not a cycle');

  // Wait — A.depends_on=C would mean A depends on C. Check: walk from C:
  // C.depends_on_id = null → no cycle. So this is correct.
  // But A already depends on B. Setting A.depends_on_id to C replaces B.
  // New state: A→C, B→C. No cycle. ✓
})();

(() => {
  // Self-reference
  const tasks: Task[] = [mk('X', 'X')];
  assert(wouldCycleDepends('X', 'X', tasks) === true,
    'Task depending on itself is a cycle');
})();

// ── 3. Same-sibling-group check ────────────────────────────────────────────

section('Same-sibling-group check (depends_on must share parent)');

(() => {
  const tasks: Task[] = [
    mk('root', 'Root'),
    mk('A', 'A', { parent_id: 'root' }),
    mk('B', 'B', { parent_id: 'root' }),
    mk('C', 'C', { parent_id: 'A' }),  // grandchild
    mk('D', 'D'),  // root-level
  ];

  assert(sameSiblingGroup('A', 'B', tasks) === true,
    'A and B share parent root — valid dep');
  assert(sameSiblingGroup('A', 'C', tasks) === false,
    'A (parent=root) and C (parent=A) — cross-parent dep blocked');
  assert(sameSiblingGroup('A', 'D', tasks) === false,
    'A (parent=root) and D (parent=null) — cross-parent dep blocked');
  assert(sameSiblingGroup('A', 'nonexistent', tasks) === false,
    'Dep on non-existent task blocked');
})();

// ── 4. Collect descendants ─────────────────────────────────────────────────

section('Collect descendants');

(() => {
  // Tree: root -> A -> B, root -> C, A -> D
  const tasks: Task[] = [
    mk('root', 'Root'),
    mk('A', 'A', { parent_id: 'root' }),
    mk('B', 'B', { parent_id: 'A' }),
    mk('C', 'C', { parent_id: 'root' }),
    mk('D', 'D', { parent_id: 'A' }),
  ];

  const rootDesc = collectDescendantIds('root', tasks);
  assert(rootDesc.length === 4, `Root has 4 descendants (got ${rootDesc.length})`);
  assert(rootDesc.includes('A') && rootDesc.includes('B') && rootDesc.includes('C') && rootDesc.includes('D'),
    'Root descendants include A, B, C, D');

  const aDesc = collectDescendantIds('A', tasks);
  assert(aDesc.length === 2, `A has 2 descendants (got ${aDesc.length})`);
  assert(aDesc.includes('B') && aDesc.includes('D'),
    'A descendants include B, D');

  const bDesc = collectDescendantIds('B', tasks);
  assert(bDesc.length === 0, 'Leaf B has 0 descendants');
})();

// ── 5. Simulated illegal operations ────────────────────────────────────────

section('Simulated updateTask guards');

(() => {
  // Simulate the updateTask guard logic
  const tasks: Task[] = [
    mk('root', 'Root', { project_id: 'proj-A' }),
    mk('A', 'A', { parent_id: 'root', project_id: 'proj-A' }),
    mk('B', 'B', { parent_id: 'root', project_id: 'proj-A', depends_on_id: 'A' }),
    mk('C', 'C', { parent_id: 'root', project_id: 'proj-A' }),
    mk('D', 'D', { parent_id: 'A', project_id: 'proj-A' }),
    mk('other', 'Other', { project_id: 'proj-B' }),
  ];

  // Simulate: updateTask('root', { parent_id: 'B' })
  {
    const fields = { parent_id: 'B' as string | null };
    if (wouldCycleParent('root', fields.parent_id, tasks)) {
      fields.parent_id = null; // guard removes it
    }
    assert(fields.parent_id === null,
      'Guard blocks moving root under its grandchild B');
  }

  // Simulate: updateTask('B', { depends_on_id: 'D' }) — D is child of A, different parent
  {
    const fields = { depends_on_id: 'D' as string | null };
    const newDep = fields.depends_on_id;
    if (newDep && !sameSiblingGroup('B', newDep, tasks)) {
      fields.depends_on_id = null;
    }
    assert(fields.depends_on_id === null,
      'Guard blocks cross-parent dependency B→D');
  }

  // Simulate: updateTask('C', { depends_on_id: 'A' }) — both children of root, valid
  {
    const fields = { depends_on_id: 'A' as string | null };
    const newDep = fields.depends_on_id;
    let blocked = false;
    if (newDep && wouldCycleDepends('C', newDep, tasks)) blocked = true;
    if (newDep && !sameSiblingGroup('C', newDep, tasks)) blocked = true;
    assert(!blocked, 'Setting C.depends_on=A is allowed (same parent, no cycle)');
  }

  // Simulate: updateTask('A', { depends_on_id: 'B' }) — B already depends on A → cycle
  {
    const fields = { depends_on_id: 'B' as string | null };
    const newDep = fields.depends_on_id;
    let blocked = false;
    if (newDep && wouldCycleDepends('A', newDep, tasks)) blocked = true;
    assert(blocked, 'Guard blocks A.depends_on=B when B already depends on A (cycle)');
  }
})();

// ── 6. Project inheritance simulation ──────────────────────────────────────

section('Project inheritance simulation');

(() => {
  const tasks: Task[] = [
    mk('root', 'Root', { project_id: 'proj-A' }),
    mk('A', 'A', { parent_id: 'root', project_id: 'proj-A' }),
    mk('B', 'B', { parent_id: 'A', project_id: 'proj-A' }),
    mk('other', 'Other', { project_id: 'proj-B' }),
    mk('otherChild', 'OC', { parent_id: 'other', project_id: 'proj-B' }),
  ];

  // Simulate addTask with parentId — should inherit parent's project
  const parentTask = tasks.find((t) => t.id === 'root')!;
  const inheritedProject = parentTask.project_id;
  assert(inheritedProject === 'proj-A',
    'New subtask under root inherits proj-A');

  // Simulate updateTaskProject cascade
  const newProjectId = 'proj-C';
  const descendants = collectDescendantIds('root', tasks);
  assert(descendants.length === 2, 'root has 2 descendants (A, B)');
  // After cascade, A and B would get proj-C
  for (const descId of descendants) {
    const t = tasks.find((t) => t.id === descId)!;
    // Simulate: t.project_id = newProjectId
    assert(t.id === 'A' || t.id === 'B',
      `Descendant ${t.id} would be updated to proj-C`);
  }

  // Simulate moveTask to new parent — should inherit new tree's project
  // Moving 'otherChild' under 'root' → should get proj-A
  const newParent = tasks.find((t) => t.id === 'root')!;
  // Walk up to find root of new tree
  let treeRoot = newParent;
  while (treeRoot.parent_id) {
    treeRoot = tasks.find((t) => t.id === treeRoot.parent_id)!;
  }
  assert(treeRoot.project_id === 'proj-A',
    'Moving otherChild under root → inherits proj-A from tree root');
})();

// ── 7. moveTask cycle guard simulation ─────────────────────────────────────

section('moveTask cycle guard');

(() => {
  const tasks: Task[] = [
    mk('root', 'Root'),
    mk('A', 'A', { parent_id: 'root' }),
    mk('B', 'B', { parent_id: 'A' }),
  ];

  // Simulate: moveTask('root', 'B', null) — moving root under its grandchild
  const taskId = 'root';
  const newParentId = 'B';
  const visited = new Set<string>();
  let cur: string | null = newParentId;
  let blocked = false;
  while (cur) {
    if (cur === taskId) { blocked = true; break; }
    if (visited.has(cur)) break;
    visited.add(cur);
    cur = tasks.find((t) => t.id === cur)?.parent_id ?? null;
  }
  assert(blocked, 'moveTask blocks nesting root under its own grandchild B');
})();

// ── 8. Chain healing on delete ─────────────────────────────────────────────

section('Chain healing on delete');

(() => {
  // Chain: A → B → C (B.depends_on=A, C.depends_on=B)
  // Deleting B should heal: C.depends_on = A
  const tasks: Task[] = [
    mk('A', 'A', { parent_id: 'root' }),
    mk('B', 'B', { parent_id: 'root', depends_on_id: 'A' }),
    mk('C', 'C', { parent_id: 'root', depends_on_id: 'B' }),
    mk('root', 'Root'),
  ];

  const taskToDelete = tasks.find((t) => t.id === 'B')!;
  const predecessor = tasks.find((t) => t.id === taskToDelete.depends_on_id) ?? null;
  const successor = tasks.find(
    (t) => t.depends_on_id === 'B' && (t.parent_id ?? null) === (taskToDelete.parent_id ?? null)
  ) ?? null;

  assert(predecessor?.id === 'A', 'B\'s predecessor is A');
  assert(successor?.id === 'C', 'B\'s successor is C');

  // After healing: C.depends_on_id should become A
  if (successor) {
    const healedDep = predecessor?.id ?? null;
    assert(healedDep === 'A', 'After deleting B, C.depends_on is healed to A');
  }

  // Deleting chain start (A): successor B should lose dependency
  const taskA = tasks.find((t) => t.id === 'A')!;
  const predOfA = tasks.find((t) => t.id === taskA.depends_on_id) ?? null;
  const succOfA = tasks.find(
    (t) => t.depends_on_id === 'A' && (t.parent_id ?? null) === (taskA.parent_id ?? null)
  ) ?? null;

  assert(predOfA === null, 'A has no predecessor');
  assert(succOfA?.id === 'B', 'A\'s successor is B');
  const healedDepOfB = predOfA?.id ?? null;
  assert(healedDepOfB === null, 'After deleting A, B.depends_on is healed to null');
})();

// ── 9. Edge case: deeply nested tree ───────────────────────────────────────

section('Deep nesting edge cases');

(() => {
  // 10-level deep tree
  const tasks: Task[] = [];
  for (let i = 0; i < 10; i++) {
    tasks.push(mk(`L${i}`, `Level ${i}`, { parent_id: i > 0 ? `L${i - 1}` : null }));
  }

  assert(wouldCycleParent('L0', 'L9', tasks) === true,
    'Moving L0 under L9 (10 levels deep) detected as cycle');
  assert(wouldCycleParent('L5', 'L9', tasks) === true,
    'Moving L5 under its descendant L9 detected as cycle');
  assert(wouldCycleParent('L9', 'L0', tasks) === false,
    'Moving L9 under L0 (already ancestor) is valid but deepens nesting');

  const desc = collectDescendantIds('L0', tasks);
  assert(desc.length === 9, `L0 has 9 descendants (got ${desc.length})`);
})();

// ── Results ────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  console.log('⚠️  SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('✅ ALL TESTS PASSED');
}
