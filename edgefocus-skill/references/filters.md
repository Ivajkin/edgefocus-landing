# Filter query notes

Use filters with `GET /tasks/all` and `GET /filters/{id}`. Filter fields are snake_case in the API.

## Due today (date math)
- filter: `due_date >= now/d && due_date < now/d+1d`
- filter_timezone: `Europe/Moscow` (or set `EDGE_TIMEZONE` for scripts)

## Overdue
- filter: `due_date < now`

## Next 7 days
- filter: `due_date >= now/d && due_date < now/d+7d`

## Include nulls
- filter_include_nulls: `true`

## Tips
- Combine with `sort_by=due_date` and `order=asc`.
- Date math anchors: `now`, `now/d`, `now/w`, then `+1d`, `-1w`, `/d`.
