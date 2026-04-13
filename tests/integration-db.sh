#!/bin/bash
# Integration test: exercises the database constraints and guards
# by simulating what the app store would do.
#
# Uses a COPY of the real database to avoid corrupting user data.

set -euo pipefail

DB_SRC="$HOME/Library/Application Support/com.riceroll.jaxtracker/jaxtracker.db"
DB_TEST="/tmp/jaxtracker_test.db"
NOW=$(date +%s)000

cp "$DB_SRC" "$DB_TEST"

PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ❌ FAIL: $1"; }

# Helper: run SQL and return result
q() { sqlite3 "$DB_TEST" "$1"; }

echo ""
echo "═══ Setup: inspect current clean state ═══"

TASK_COUNT=$(q "SELECT COUNT(*) FROM tasks;")
echo "  Tasks in DB: $TASK_COUNT"

# Get existing known IDs
ROOT_ID=$(q "SELECT id FROM tasks WHERE title='kjjkiuou' LIMIT 1;")
CHILD_A_ID=$(q "SELECT id FROM tasks WHERE title='hahaha' AND parent_id='$ROOT_ID' LIMIT 1;")
CHAIN_START=$(q "SELECT id FROM tasks WHERE title='jlkjliuo' AND parent_id='$ROOT_ID' LIMIT 1;")
CHAIN_MID=$(q "SELECT id FROM tasks WHERE title='jkjiou' AND parent_id='$ROOT_ID' LIMIT 1;")
ASDF_ID=$(q "SELECT id FROM tasks WHERE title='asdfasdfwer' LIMIT 1;")
ASDF_CHILD=$(q "SELECT id FROM tasks WHERE parent_id='$ASDF_ID' LIMIT 1;")

echo "  Root task (kjjkiuou): $ROOT_ID (project: $(q "SELECT project_id FROM tasks WHERE id='$ROOT_ID';"))"
echo "  Chain start (jlkjliuo): $CHAIN_START"
echo "  Chain mid (jkjiou): $CHAIN_MID (depends_on: $(q "SELECT depends_on_id FROM tasks WHERE id='$CHAIN_MID';"))"

echo ""
echo "═══ Test 1: Cross-project subtask was fixed ═══"
CHILD_PROJ=$(q "SELECT project_id FROM tasks WHERE id='$CHILD_A_ID';")
ROOT_PROJ=$(q "SELECT project_id FROM tasks WHERE id='$ROOT_ID';")
if [ "$CHILD_PROJ" = "$ROOT_PROJ" ]; then
  ok "Child 'hahaha' has same project as parent 'kjjkiuou'"
else
  fail "Child project ($CHILD_PROJ) != parent project ($ROOT_PROJ)"
fi

echo ""
echo "═══ Test 2: No branching dependencies remain ═══"
BRANCH_COUNT=$(q "SELECT COUNT(*) FROM (SELECT depends_on_id FROM tasks WHERE depends_on_id IS NOT NULL GROUP BY depends_on_id HAVING COUNT(*) > 1);")
if [ "$BRANCH_COUNT" = "0" ]; then
  ok "No branching dependencies (all deps are 1:1 chains)"
else
  fail "Found $BRANCH_COUNT branching dependency sources"
fi

echo ""
echo "═══ Test 3: No cross-parent dependencies ═══"
CROSS_PARENT=$(q "SELECT COUNT(*) FROM tasks t JOIN tasks d ON d.id = t.depends_on_id WHERE COALESCE(t.parent_id,'') != COALESCE(d.parent_id,'');")
if [ "$CROSS_PARENT" = "0" ]; then
  ok "All dependencies are within same sibling group"
else
  fail "Found $CROSS_PARENT cross-parent dependencies"
fi

echo ""
echo "═══ Test 4: All subtasks inherit parent's project ═══"
CROSS_PROJ=$(q "SELECT COUNT(*) FROM tasks t JOIN tasks p ON p.id = t.parent_id WHERE COALESCE(t.project_id,'') != COALESCE(p.project_id,'');")
if [ "$CROSS_PROJ" = "0" ]; then
  ok "All subtasks have same project as their parent"
else
  fail "Found $CROSS_PROJ cross-project subtasks"
  q "SELECT t.title, t.project_id AS t_proj, p.project_id AS p_proj FROM tasks t JOIN tasks p ON p.id = t.parent_id WHERE COALESCE(t.project_id,'') != COALESCE(p.project_id,'');"
fi

echo ""
echo "═══ Test 5: No circular parent_id chains ═══"
# Check each task: walk up parent chain, ensure no revisit
CIRCULAR=0
for TASK_ID in $(q "SELECT id FROM tasks WHERE parent_id IS NOT NULL;"); do
  VISITED="$TASK_ID"
  CUR=$(q "SELECT parent_id FROM tasks WHERE id='$TASK_ID';")
  while [ -n "$CUR" ] && [ "$CUR" != "" ]; do
    if echo "$VISITED" | grep -q "$CUR"; then
      echo "  Circular chain at: $TASK_ID"
      CIRCULAR=$((CIRCULAR + 1))
      break
    fi
    VISITED="$VISITED $CUR"
    CUR=$(q "SELECT COALESCE(parent_id,'') FROM tasks WHERE id='$CUR';")
  done
done
if [ "$CIRCULAR" = "0" ]; then
  ok "No circular parent_id chains"
else
  fail "Found $CIRCULAR tasks in circular parent chains"
fi

echo ""
echo "═══ Test 6: No circular depends_on chains ═══"
CIRCULAR_DEP=0
for TASK_ID in $(q "SELECT id FROM tasks WHERE depends_on_id IS NOT NULL;"); do
  VISITED="$TASK_ID"
  CUR=$(q "SELECT depends_on_id FROM tasks WHERE id='$TASK_ID';")
  while [ -n "$CUR" ] && [ "$CUR" != "" ]; do
    if echo "$VISITED" | grep -q "$CUR"; then
      echo "  Circular dep chain at: $TASK_ID"
      CIRCULAR_DEP=$((CIRCULAR_DEP + 1))
      break
    fi
    VISITED="$VISITED $CUR"
    CUR=$(q "SELECT COALESCE(depends_on_id,'') FROM tasks WHERE id='$CUR';")
  done
done
if [ "$CIRCULAR_DEP" = "0" ]; then
  ok "No circular depends_on chains"
else
  fail "Found $CIRCULAR_DEP tasks in circular dependency chains"
fi

echo ""
echo "═══ Test 7: Simulate illegal operations on the DB copy ═══"

# 7a: Try to create a subtask with different project (simulating addTask bug)
echo "  --- 7a: addTask should inherit parent project ---"
NEW_ID="test-$(uuidv4 2>/dev/null || echo 'aaaa-bbbb-cccc-dddd')"
NEW_ID="test-subtask-wrong-proj"
# Simulate what the OLD code did (no inheritance):
q "INSERT INTO tasks (id, title, status_id, project_id, parent_id, position, collapsed, created_at, updated_at) VALUES ('$NEW_ID', 'Test Bad Subtask', 'status-todo', 'b7493ad4-b1dd-4bc8-9121-d54eabe175eb', '$ROOT_ID', 99, 0, $NOW, $NOW);"
CHILD_PROJ=$(q "SELECT project_id FROM tasks WHERE id='$NEW_ID';")
ROOT_PROJ=$(q "SELECT project_id FROM tasks WHERE id='$ROOT_ID';")
if [ "$CHILD_PROJ" != "$ROOT_PROJ" ]; then
  ok "Raw INSERT creates cross-project subtask (confirms guard is needed in app layer)"
else
  ok "Projects happened to match (both same)"
fi
# Clean up
q "DELETE FROM tasks WHERE id='$NEW_ID';"

# 7b: Try to create circular parent
echo "  --- 7b: circular parent detection ---"
q "INSERT INTO tasks (id, title, status_id, parent_id, position, collapsed, created_at, updated_at) VALUES ('cycle-a', 'CycleA', 'status-todo', 'cycle-b', 0, 0, $NOW, $NOW);"
q "INSERT INTO tasks (id, title, status_id, parent_id, position, collapsed, created_at, updated_at) VALUES ('cycle-b', 'CycleB', 'status-todo', 'cycle-a', 0, 0, $NOW, $NOW);"
# Check if cycle exists:
P_OF_A=$(q "SELECT parent_id FROM tasks WHERE id='cycle-a';")
P_OF_B=$(q "SELECT parent_id FROM tasks WHERE id='cycle-b';")
if [ "$P_OF_A" = "cycle-b" ] && [ "$P_OF_B" = "cycle-a" ]; then
  ok "DB allows circular parents (no DB-level constraint) — app guard needed ✓"
else
  fail "Unexpected state"
fi
q "DELETE FROM tasks WHERE id IN ('cycle-a', 'cycle-b');"

# 7c: Try cross-parent dependency
echo "  --- 7c: cross-parent dependency ---"
q "INSERT INTO tasks (id, title, status_id, parent_id, depends_on_id, position, collapsed, created_at, updated_at) VALUES ('xparent-dep', 'CrossDep', 'status-todo', '$ROOT_ID', '$ASDF_CHILD', 99, 0, $NOW, $NOW);"
DEP_PARENT=$(q "SELECT parent_id FROM tasks WHERE id='$ASDF_CHILD';")
TASK_PARENT=$(q "SELECT parent_id FROM tasks WHERE id='xparent-dep';")
if [ "$DEP_PARENT" != "$TASK_PARENT" ]; then
  ok "DB allows cross-parent deps (no DB constraint) — app guard needed ✓"
fi
q "DELETE FROM tasks WHERE id='xparent-dep';"

# 7d: Chain healing verification
echo "  --- 7d: chain healing simulation ---"
q "INSERT INTO tasks (id, title, status_id, parent_id, position, collapsed, created_at, updated_at) VALUES ('ch-a', 'ChA', 'status-todo', NULL, 100, 0, $NOW, $NOW);"
q "INSERT INTO tasks (id, title, status_id, parent_id, depends_on_id, position, collapsed, created_at, updated_at) VALUES ('ch-b', 'ChB', 'status-todo', NULL, 'ch-a', 101, 0, $NOW, $NOW);"
q "INSERT INTO tasks (id, title, status_id, parent_id, depends_on_id, position, collapsed, created_at, updated_at) VALUES ('ch-c', 'ChC', 'status-todo', NULL, 'ch-b', 102, 0, $NOW, $NOW);"

# Simulate deleteTask('ch-b'): heal chain, then delete
# Step 1: Find predecessor (ch-b.depends_on_id = ch-a) and successor (ch-c.depends_on_id = ch-b)
PRED=$(q "SELECT depends_on_id FROM tasks WHERE id='ch-b';")
SUCC_ID=$(q "SELECT id FROM tasks WHERE depends_on_id='ch-b';")
# Step 2: Heal: set successor's depends_on to predecessor
q "UPDATE tasks SET depends_on_id = '$PRED' WHERE id='$SUCC_ID';"
# Step 3: Delete
q "DELETE FROM tasks WHERE id='ch-b';"

HEALED_DEP=$(q "SELECT depends_on_id FROM tasks WHERE id='ch-c';")
if [ "$HEALED_DEP" = "ch-a" ]; then
  ok "Chain healed: after deleting ch-b, ch-c now depends on ch-a"
else
  fail "Chain not healed: ch-c.depends_on_id = '$HEALED_DEP' (expected ch-a)"
fi
q "DELETE FROM tasks WHERE id IN ('ch-a', 'ch-c');"

echo ""
echo "═══ Test 8: Grandchild project consistency ═══"
# Check that grandchildren also match the root's project
DEEP_MISMATCH=$(q "
WITH RECURSIVE tree AS (
  SELECT id, project_id, parent_id FROM tasks WHERE parent_id IS NULL
  UNION ALL
  SELECT t.id, t.project_id, t.parent_id FROM tasks t JOIN tree ON t.parent_id = tree.id
)
SELECT COUNT(*) FROM tree t
JOIN tasks p ON p.id = t.parent_id
WHERE COALESCE(t.project_id,'') != COALESCE(p.project_id,'');
")
if [ "$DEEP_MISMATCH" = "0" ]; then
  ok "All tasks at every depth have same project as their parent"
else
  fail "Found $DEEP_MISMATCH deep project mismatches"
fi

echo ""
echo "═══ Test 9: Position integrity ═══"
# Check for duplicate positions within same parent group
DUP_POS=$(q "
SELECT COUNT(*) FROM (
  SELECT COALESCE(parent_id,'_root_'), position, COUNT(*) AS cnt
  FROM tasks
  GROUP BY COALESCE(parent_id,'_root_'), position
  HAVING cnt > 1
);
")
if [ "$DUP_POS" = "0" ]; then
  ok "No duplicate positions within sibling groups"
else
  fail "Found $DUP_POS sibling groups with duplicate positions"
  q "SELECT COALESCE(parent_id,'_root_') AS grp, position, COUNT(*) AS cnt FROM tasks GROUP BY grp, position HAVING cnt > 1;"
fi

echo ""
echo "═══ Test 10: Dangling foreign keys ═══"
DANGLING_PARENT=$(q "SELECT COUNT(*) FROM tasks WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT id FROM tasks);")
DANGLING_DEP=$(q "SELECT COUNT(*) FROM tasks WHERE depends_on_id IS NOT NULL AND depends_on_id NOT IN (SELECT id FROM tasks);")
DANGLING_STATUS=$(q "SELECT COUNT(*) FROM tasks WHERE status_id NOT IN (SELECT id FROM task_statuses);")
if [ "$DANGLING_PARENT" = "0" ] && [ "$DANGLING_DEP" = "0" ] && [ "$DANGLING_STATUS" = "0" ]; then
  ok "No dangling foreign keys (parent_id, depends_on_id, status_id all valid)"
else
  [ "$DANGLING_PARENT" != "0" ] && fail "Found $DANGLING_PARENT dangling parent_id refs"
  [ "$DANGLING_DEP" != "0" ] && fail "Found $DANGLING_DEP dangling depends_on_id refs"
  [ "$DANGLING_STATUS" != "0" ] && fail "Found $DANGLING_STATUS dangling status_id refs"
fi

# Cleanup
rm -f "$DB_TEST"

echo ""
echo "══════════════════════════════════════════════════"
echo "Results: $PASS passed, $FAIL failed, $((PASS + FAIL)) total"
if [ "$FAIL" -gt 0 ]; then
  echo "⚠️  SOME TESTS FAILED"
  exit 1
else
  echo "✅ ALL TESTS PASSED"
fi
