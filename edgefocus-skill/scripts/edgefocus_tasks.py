#!/usr/bin/env python3
"""
EdgeFocus Task Helpers

Commands:
  due-today       List tasks due today using filter/date math
  label-wsjf      Apply WSJF score labels to tasks
  mark-done       Mark tasks done
  export-context  Export tasks for LLM context analysis  
"""
import argparse
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_BASE = "https://edgefocus.ru/api/v1"
DEFAULT_COLOR = "#9E9E9E"
WSJF_PREFIX = "wsjf:"


class EdgeHttpError(RuntimeError):
    def __init__(self, code, method, path, body):
        msg = f"HTTP {code} {method} {path}"
        if body:
            msg += f": {body.strip()}"
        super().__init__(msg)
        self.code = code
        self.body = body


class Client:
    def __init__(self, base, token, timeout):
        self.base = base.rstrip("/")
        self.token = token
        self.timeout = timeout
        if not self.token:
            raise SystemExit("EDGE_TOKEN is required (or --token).")

    def request(self, method, path, params=None, body=None):
        url = f"{self.base}{path}"
        if params:
            url += "?" + urllib.parse.urlencode(params, doseq=True)
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
        }
        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = resp.read()
                headers_resp = {k.lower(): v for k, v in resp.headers.items()}
            if not payload:
                return None, headers_resp
            return json.loads(payload.decode()), headers_resp
        except urllib.error.HTTPError as e:
            body_text = e.read().decode(errors="ignore")
            raise EdgeHttpError(e.code, method, path, body_text)

    def iter_pages(self, path, params, per_page):
        page = 1
        while True:
            page_params = dict(params)
            page_params["page"] = page
            page_params["per_page"] = per_page
            data, headers = self.request("GET", path, params=page_params)
            for item in data or []:
                yield item
            total_pages = int(headers.get("x-pagination-total-pages", "1"))
            if page >= total_pages:
                break
            page += 1

    def list_labels(self):
        labels = []
        page = 1
        while True:
            data, headers = self.request("GET", "/labels", params={"per_page": 250, "page": page})
            labels.extend(data or [])
            total_pages = int(headers.get("x-pagination-total-pages", "1"))
            if page >= total_pages:
                break
            page += 1
        return labels

    def create_label(self, title, color):
        data, _ = self.request("PUT", "/labels", body={"title": title, "hex_color": color})
        return data

    def get_task_labels(self, task_id):
        data, _ = self.request("GET", f"/tasks/{task_id}/labels")
        return data or []

    def add_label(self, task_id, label_id):
        self.request("PUT", f"/tasks/{task_id}/labels", body={"label_id": label_id})

    def remove_label(self, task_id, label_id):
        self.request("DELETE", f"/tasks/{task_id}/labels/{label_id}")

    def get_task(self, task_id):
        data, _ = self.request("GET", f"/tasks/{task_id}")
        return data or {}

    def update_task(self, task_id, payload):
        data, _ = self.request("POST", f"/tasks/{task_id}", body=payload)
        return data or {}


def parse_pair(text):
    text = text.strip()
    if not text:
        raise ValueError("empty pair")
    for sep in ("=", ":", ","):
        if sep in text:
            left, right = text.split(sep, 1)
            return left.strip(), right.strip()
    parts = text.split()
    if len(parts) >= 2:
        return parts[0].strip(), parts[1].strip()
    raise ValueError(f"invalid pair: {text}")


def normalize_score(score, precision, no_normalize):
    if no_normalize:
        return score
    try:
        return f"{float(score):.{precision}f}"
    except ValueError:
        return score


def parse_pairs(args):
    pairs = []
    for item in args.task or []:
        task_id, score = parse_pair(item)
        pairs.append((task_id, score))
    if args.file:
        with open(args.file, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                task_id, score = parse_pair(line)
                pairs.append((task_id, score))
    if not pairs:
        raise SystemExit("No task=score pairs provided.")
    parsed = {}
    for task_id, score in pairs:
        try:
            tid = int(task_id)
        except ValueError:
            raise SystemExit(f"Invalid task id: {task_id}")
        score = normalize_score(score, args.precision, args.no_normalize)
        parsed[tid] = score
    return parsed


def parse_ids(args):
    ids = []
    for item in args.task or []:
        ids.append(int(item))
    if args.file:
        with open(args.file, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                for token in re.split(r"[\s,]+", line):
                    if token.isdigit():
                        ids.append(int(token))
    if not ids:
        raise SystemExit("No task ids provided.")
    return sorted(set(ids))


def cmd_due_today(client, args):
    params = {
        "filter": "due_date >= now/d && due_date < now/d+1d",
        "filter_timezone": args.timezone,
        "sort_by": "due_date",
        "order": "asc",
    }
    tasks = list(client.iter_pages("/tasks/all", params, args.per_page))
    if args.format == "json":
        print(json.dumps(tasks, ensure_ascii=True))
        return
    if args.format == "ids":
        for task in tasks:
            print(task.get("id"))
        return
    for task in tasks:
        print(f"{task.get('id')}\t{task.get('due_date','')}\t{task.get('title','')}")


def ensure_labels(client, titles, color):
    label_map = {label.get("title"): label.get("id") for label in client.list_labels()}
    created = 0
    for title in titles:
        if title in label_map:
            continue
        label = client.create_label(title, color)
        label_map[title] = label.get("id")
        created += 1
    return label_map, created


def cmd_label_wsjf(client, args):
    task_scores = parse_pairs(args)
    titles = sorted({f"{WSJF_PREFIX}{score}" for score in task_scores.values()})
    label_map, created = ensure_labels(client, titles, args.color)

    updated = 0
    skipped = 0
    removed = 0

    for task_id, score in task_scores.items():
        desired_title = f"{WSJF_PREFIX}{score}"
        desired_id = label_map.get(desired_title)
        if desired_id is None:
            raise SystemExit(f"Missing label id for {desired_title}")

        if args.dry_run:
            print(f"would label task {task_id} with {desired_title}")
            continue

        if args.cleanup:
            labels = client.get_task_labels(task_id)
            existing = {lbl.get("id"): lbl.get("title") for lbl in labels}
            for lid, title in list(existing.items()):
                if title and title.lower().startswith(WSJF_PREFIX) and lid != desired_id:
                    client.remove_label(task_id, lid)
                    removed += 1
            if desired_id in existing:
                skipped += 1
            else:
                client.add_label(task_id, desired_id)
                updated += 1
            continue

        try:
            client.add_label(task_id, desired_id)
            updated += 1
        except EdgeHttpError as e:
            if e.code in (400, 409):
                skipped += 1
            else:
                raise

    if not args.dry_run:
        print(f"labels_created={created} tasks_labeled={updated} tasks_skipped={skipped} labels_removed={removed}")


def cmd_export_context(client, args):
    params = {
        "sort_by": "due_date",
        "order": "asc",
    }
    tasks = list(client.iter_pages("/tasks/all", params, args.per_page))

    print(f"# EdgeFocus Goals Export\n")
    print(f"Generated for conflict analysis context. Only Active tasks shown.\n")

    for task in tasks:
        if task.get("done"):
            continue
            
        tid = task.get("id")
        title = task.get("title", "").replace("\n", " ").strip()
        desc = task.get("description", "").strip() or "(No description)"
        
        prio_val = task.get("priority", 0)
        
        due = task.get("due_date")
        if due:
            due = due.split("T")[0]
        else:
            due = "None"
            
        labels = [lbl.get("title") for lbl in (task.get("labels") or [])]
        label_str = ", ".join(labels) if labels else "None"
        
        status = "Done" if task.get("done") else "Active"

        print(f"## Task {tid}: {title}")
        print(f"- **Status**: {status}")
        print(f"- **Priority**: {prio_val}")
        print(f"- **Due**: {due}")
        print(f"- **Labels**: {label_str}")
        print(f"\n{desc}\n")
        print(f"---\n")


def cmd_mark_done(client, args):
    task_ids = parse_ids(args)
    for task_id in task_ids:
        task = client.get_task(task_id)
        payload = {
            "title": task.get("title", ""),
            "description": task.get("description", ""),
            "labels": [lbl.get("id") for lbl in (task.get("labels") or [])],
            "assignees": [asg.get("id") for asg in (task.get("assignees") or [])],
            "done": True,
            "priority": task.get("priority", 0),
            "due_date": task.get("due_date"),
            "start_date": task.get("start_date"),
            "end_date": task.get("end_date"),
            "repeat_after": task.get("repeat_after", 0),
            "repeat_mode": task.get("repeat_mode", 0),
            "bucket_id": task.get("bucket_id", 0),
            "project_id": task.get("project_id", 0),
        }
        if args.dry_run:
            print(f"would mark done: {task_id}")
            continue
        updated = client.update_task(task_id, payload)
        print(f"{updated.get('id')}\t{updated.get('done')}\t{updated.get('done_at','')}")


def build_parser():
    parser = argparse.ArgumentParser(description="EdgeFocus task helpers")
    parser.add_argument("--base", default=os.environ.get("EDGE_BASE", DEFAULT_BASE))
    parser.add_argument("--token", default=os.environ.get("EDGE_TOKEN", ""))
    parser.add_argument("--timeout", type=int, default=20)

    sub = parser.add_subparsers(dest="command", required=True)

    due = sub.add_parser("due-today", help="List tasks due today using filter/date math")
    due.add_argument("--timezone", default=os.environ.get("EDGE_TIMEZONE", "UTC"))
    due.add_argument("--per-page", type=int, default=250)
    due.add_argument("--format", choices=["tsv", "json", "ids"], default="tsv")

    label = sub.add_parser("label-wsjf", help="Apply WSJF score labels to tasks")
    label.add_argument("--task", action="append", help="Pair like 123=4.50 (repeatable)")
    label.add_argument("--file", help="File with task/score pairs")
    label.add_argument("--color", default=DEFAULT_COLOR)
    label.add_argument("--cleanup", action="store_true", help="Remove other wsjf:* labels")
    label.add_argument("--dry-run", action="store_true")
    label.add_argument("--no-normalize", action="store_true", help="Do not normalize score")
    label.add_argument("--precision", type=int, default=2, help="Decimals for score normalization")

    done = sub.add_parser("mark-done", help="Mark tasks done")
    done.add_argument("--task", action="append", type=int, help="Task id (repeatable)")
    done.add_argument("--file", help="File with task ids")
    done.add_argument("--dry-run", action="store_true")

    export = sub.add_parser("export-context", help="Export tasks for LLM context analysis")
    export.add_argument("--per-page", type=int, default=50)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    client = Client(args.base, args.token, args.timeout)

    if args.command == "due-today":
        cmd_due_today(client, args)
    elif args.command == "label-wsjf":
        cmd_label_wsjf(client, args)
    elif args.command == "mark-done":
        cmd_mark_done(client, args)
    elif args.command == "export-context":
        cmd_export_context(client, args)
    else:
        parser.error("Unknown command")


if __name__ == "__main__":
    main()
