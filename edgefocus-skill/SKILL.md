---
name: edgefocus-api
description: Work with the EdgeFocus API for tasks, labels, and filters using curl/httpie. Use when creating, updating, listing, or filtering tasks via the EdgeFocus REST API, managing labels, or scripting repeatable operations.
---

# EdgeFocus API

Use this when you need to hit the EdgeFocus REST API for tasks/labels/filters. Keep context lean; load `references/cheatsheet.md` only when you need exact commands or payload shapes, and `references/filters.md` only when building filter queries or date math.

## Quick start
- Base URL: export `EDGE_BASE=${EDGE_BASE:-https://edgefocus.ru/api/v1}`
- Auth: export `EDGE_TOKEN=<bearer token>`; send `Authorization: Bearer $EDGE_TOKEN`
- Timezone (optional for scripts/filters): export `EDGE_TIMEZONE=Europe/Moscow`
- Tools: `httpie` (preferred for session reuse) or `curl` + `jq`
- Swagger: `https://edgefocus.ru/api/v1/docs` or `docs.json`

### HTTPie session (bearer saved)
```bash
http --session=edgefocus -A bearer -a "$EDGE_TOKEN" GET "$EDGE_BASE/labels" per_page==250
# reuse later (no token needed)
http --session=edgefocus GET "$EDGE_BASE/tasks/all" per_page==50 expand==comments
```

### Curl auth helper
```bash
auth=(-H "Authorization: Bearer $EDGE_TOKEN" -H "Accept: application/json" -H "Content-Type: application/json")
```

## Common flows
- **List labels**: `curl -sS "${auth[@]}" "$EDGE_BASE/labels?per_page=250" | jq`
- **Upsert labels**: reuse repo script `tools/upsert-edge-labels.sh` (expects EDGE_TOKEN, optional EDGE_BASE).
- **Create task in project**: `PUT /projects/{projectID}/tasks` with minimal body `{ "title": "...", "description": "...", "labels": [<labelIDs>], "due_date": "<RFC3339>", "priority": <int>, "bucket_id": <id> }`
- **List tasks (all)**: `GET /tasks/all?per_page=50&page=1&sort_by=due_date&order=asc&expand=subtasks,comments,buckets`
- **Get/update task**: `GET /tasks/{id}`; `POST /tasks/{id}` with same Task payload to update (including labels array by id). Mark done with `"done": true` or status field; keep unchanged fields present to avoid clearing.
- **Assign user**: `PUT /tasks/{taskID}/assignees` with body `{ "user_id": <id> }` (repeat for multiples).
- **Move within board view**: `POST /projects/{project}/views/{view}/buckets/{bucket}/tasks` for creation in a specific bucket; adjust positions via `/tasks/{id}/position`.
- **Filters**: `GET /filters` to list saved filters; `GET /filters/{id}` to inspect query syntax (labels are numeric ids). Update via `POST /filters/{id}` with same schema.

## Automation helpers (scripts/)
- Use `scripts/edgefocus_tasks.py` for repeatable flows (due today, WSJF labels, mark done).
  - Due today: `python3 scripts/edgefocus_tasks.py due-today --timezone "$EDGE_TIMEZONE"`
  - Apply WSJF labels: `python3 scripts/edgefocus_tasks.py label-wsjf --file wsjf.tsv`
  - Mark done: `python3 scripts/edgefocus_tasks.py mark-done --task 123`

## When editing payloads
- Labels must be numeric IDs (not titles); fetch labels first.
- Prefer RFC3339 timestamps (e.g., `2025-02-15T12:00:00Z`) for `due_date`/`start_date`.
- Send complete arrays for labels/assignees to avoid dropping existing items.
- Pagination headers: `x-pagination-total-pages`, `x-pagination-result-count`.
- **IMPORTANT**: When updating tasks via POST, fetch the current task first (GET `/tasks/{id}`), modify only needed fields, then POST the complete object to avoid clearing unspecified fields.

## ⚠️ Troubleshooting & Best Practices

### curl PUT requests may hang
**Problem**: `curl -X PUT /projects/{id}/tasks` can hang indefinitely without timeout.

**Solutions**:
1. Always use `--max-time N` with curl (e.g., `--max-time 10`)
2. For bulk operations (>3 tasks), use Python with urllib/requests instead of curl
3. Add explicit timeouts in scripts: `timeout=30` in Python or `--max-time 30` in curl

### Python for bulk operations (recommended)
```python
import urllib.request
import json
import os

EDGE_BASE = os.environ.get('EDGE_BASE', 'https://edgefocus.ru/api/v1')
EDGE_TOKEN = os.environ['EDGE_TOKEN']

def api_request(endpoint, method='GET', data=None):
    url = f"{EDGE_BASE}{endpoint}"
    headers = {
        'Authorization': f'Bearer {EDGE_TOKEN}',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode('utf-8'))

# Create task
task = api_request('/projects/1/tasks', 'PUT', {'title': 'New task'})

# Update task (preserve all fields)
current = api_request(f'/tasks/{task["id"]}')
current['description'] = 'Updated description'
api_request(f'/tasks/{task["id"]}', 'POST', current)
```

### Creating subtasks (task relations)
To link tasks as subtasks, use the relations endpoint:

```python
# After creating child task
relation = api_request(
    f'/tasks/{parent_id}/relations',
    'PUT',
    {'other_task_id': child_id, 'relation_kind': 'subtask'}
)
```

Available relation kinds: `subtask`, `parenttask`, `related`, `duplicates`, `blocks`, `blocked`

## References
- See `references/cheatsheet.md` for ready-to-run curl/httpie snippets (create/list/update tasks, filters, labels).
- See `references/filters.md` for filter syntax, date math, and timezone tips.
