# EdgeFocus API Cheatsheet

Set env:
```bash
export EDGE_BASE=${EDGE_BASE:-https://edgefocus.ru/api/v1}
export EDGE_TOKEN=<token>
auth=(-H "Authorization: Bearer $EDGE_TOKEN" -H "Accept: application/json" -H "Content-Type: application/json")
```

## Labels
List:
```bash
curl -sS "${auth[@]}" "$EDGE_BASE/labels?per_page=250" | jq
```
Upsert standard set:
```bash
./tools/upsert-edge-labels.sh   # uses EDGE_TOKEN and optional EDGE_BASE
```

## Tasks
Create in project (board-neutral):
```bash
project_id=1
curl -sS -X PUT "${auth[@]}" "$EDGE_BASE/projects/$project_id/tasks" --data-raw '{
  "title":"My task",
  "description":"Details",
  "labels":[123,124],
  "priority":0,
  "due_date":"2025-02-15T12:00:00Z"
}' | jq
```
Create directly into a view bucket:
```bash
project_id=1; view_id=2; bucket_id=5
curl -sS -X PUT "${auth[@]}" "$EDGE_BASE/projects/$project_id/views/$view_id/buckets/$bucket_id/tasks" --data-raw '{
  "title":"Backlog item",
  "labels":[123]
}'
```
List all (with expansions):
```bash
curl -sS "${auth[@]}" "$EDGE_BASE/tasks/all?per_page=50&page=1&expand=subtasks,comments,buckets&sort_by=due_date&order=asc" | jq
```
Get one:
```bash
curl -sS "${auth[@]}" "$EDGE_BASE/tasks/42?expand=subtasks,comments" | jq
```
Update (idempotent: send full desired arrays):
```bash
curl -sS -X POST "${auth[@]}" "$EDGE_BASE/tasks/42" --data-raw '{
  "title":"Updated title",
  "description":"Updated text",
  "labels":[123,124],
  "done":true,
  "priority":1
}'
```
Set position within board (example to bottom of bucket):
```bash
curl -sS -X POST "${auth[@]}" "$EDGE_BASE/tasks/42/position" --data-raw '{
  "bucket_id":5,
  "position":1000000
}'
```
Assign user:
```bash
curl -sS -X PUT "${auth[@]}" "$EDGE_BASE/tasks/42/assignees" --data-raw '{ "user_id": 1 }'
```

## Filters (saved searches)
List:
```bash
curl -sS "${auth[@]}" "$EDGE_BASE/filters" | jq
```
Get one (inspect query payload, labels are numeric IDs):
```bash
curl -sS "${auth[@]}" "$EDGE_BASE/filters/7" | jq
```
Update filter:
```bash
curl -sS -X POST "${auth[@]}" "$EDGE_BASE/filters/7" --data-raw '{
  "title":"Owner Cockpit",
  "description":"Stable labels",
  "filters":[
    {"field":"labels","operator":"in","value":[123,124]}
  ]
}'
```
