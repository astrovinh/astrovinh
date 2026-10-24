#!/usr/bin/env python3
"""Local, read-only Codex telemetry. Only the allowlisted run facts leave here."""
import json
import hashlib
import os
import re
import time
import sys


def epoch(value):
    from datetime import datetime
    try:
        return int(datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp() * 1000)
    except (AttributeError, TypeError, ValueError, OverflowError):
        return None


def text(value):
    return value if isinstance(value, str) else None


def parse_file(path, previous=None, limit=None):
    run = previous.get('run') if previous else None
    first_user = previous.get('firstUser', False) if previous else False
    offset = previous.get('offset', 0) if previous else 0
    try:
        with open(path, 'rb') as stream:
            stream.seek(offset)
            while True:
                remaining = limit - offset if limit is not None else -1
                if remaining == 0:
                    break
                line = stream.readline(remaining)
                if not line or not line.endswith(b'\n'):
                    break
                offset = stream.tell()
                try:
                    event = json.loads(line)
                    if not isinstance(event, dict):
                        continue
                    payload = event.get('payload')
                    at = epoch(event.get('timestamp'))
                    if not isinstance(payload, dict) or at is None:
                        continue
                    kind = event.get('type')
                    if kind == 'session_meta' and run is None:
                        source = payload.get('source')
                        spawn = source.get('subagent', {}).get('thread_spawn', {}) if isinstance(source, dict) and isinstance(source.get('subagent'), dict) else {}
                        if not isinstance(spawn, dict):
                            spawn = {}
                        if not text(payload.get('id')):
                            continue
                        run = dict(id=payload['id'], parentId=text(spawn.get('parent_thread_id')),
                                   kind='helper' if spawn else 'run', role=text(spawn.get('agent_role')),
                                   nickname=text(spawn.get('agent_nickname')), label=None,
                                   startedAt=at, lastAt=at, cmds=0, spawned=0, done=False, tokens=None)
                    if run is None:
                        continue
                    if at >= run['lastAt']:
                        run['lastAt'] = at
                        run['done'] = kind == 'event_msg' and payload.get('type') == 'task_complete'
                    if kind == 'response_item':
                        run['cmds'] += int(payload.get('type') == 'custom_tool_call' and payload.get('name') == 'exec')
                        run['spawned'] += int(payload.get('type') == 'function_call' and payload.get('name') == 'spawn_agent')
                        if not first_user and payload.get('type') == 'message' and payload.get('role') == 'user':
                            first_user = True
                            content = payload.get('content', [])
                            if isinstance(content, list):
                                for part in content:
                                    if not isinstance(part, dict) or not isinstance(part.get('text'), str):
                                        continue
                                    match = re.search(r'[A-Za-z0-9_.-]*brief(?:\.md)?', part['text'])
                                    if match:
                                        run['label'] = re.sub(r'-brief$', '', re.sub(r'\.md$', '', match.group()))
                                        break
                    if kind == 'event_msg' and payload.get('type') == 'token_count':
                        usage = payload.get('info', {}).get('total_token_usage', {})
                        value = usage.get('total_tokens') if isinstance(usage, dict) else None
                        if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
                            run['tokens'] = value
                except (ValueError, TypeError, AttributeError, KeyError, OverflowError):
                    continue
    except (OSError, ValueError):
        return None
    return {'run': run, 'firstUser': first_user, 'offset': offset}


def cache_path():
    return os.path.join(os.path.expanduser('~'), '.cache', 'party', 'codex-scan.json')


def valid_run(run):
    fields = {'id', 'parentId', 'kind', 'role', 'nickname', 'label', 'startedAt', 'lastAt', 'cmds', 'spawned', 'done', 'tokens'}
    if not isinstance(run, dict) or set(run) != fields:
        return False
    number = lambda value: type(value) is int and 0 <= value <= 9007199254740991
    name = lambda value: value is None or isinstance(value, str) and not re.search(r'[\x00-\x1f\x7f]', value)
    return (isinstance(run['id'], str) and bool(run['id']) and name(run['id'])
            and all(name(run[k]) for k in ('parentId', 'role', 'nickname', 'label'))
            and run['kind'] in ('run', 'helper') and type(run['done']) is bool
            and all(number(run[k]) for k in ('startedAt', 'lastAt', 'cmds', 'spawned'))
            and (run['tokens'] is None or number(run['tokens'])))


def read_cache(now):
    try:
        with open(cache_path(), 'rb') as source:
            value = json.load(source)
        if value.get('version') != 1 or not isinstance(value.get('logs'), dict):
            return {}, True
        logs = {}
        for key, entry in value['logs'].items():
            if not isinstance(key, str) or not re.fullmatch(r'[0-9a-f]{64}', key) or not isinstance(entry, dict) or set(entry) != {'run', 'firstUser', 'offset', 'size', 'firstHash', 'tailHash', 'seenAt'} or type(entry.get('seenAt')) not in (int, float) or not 0 <= entry['seenAt'] <= now or now - entry['seenAt'] > 86400:
                continue
            if any(type(entry.get(k)) is not int or not 0 <= entry[k] <= 9007199254740991 for k in ('size', 'offset')):
                continue
            if entry['offset'] > entry['size'] or type(entry.get('firstUser')) is not bool or any(not isinstance(entry.get(k), str) or not re.fullmatch(r'[0-9a-f]{64}', entry[k]) for k in ('firstHash', 'tailHash')):
                continue
            run = entry.get('run')
            if run is not None and not valid_run(run):
                continue
            logs[key] = entry
        return logs, len(logs) != len(value['logs'])
    except (OSError, ValueError, TypeError, AttributeError):
        return {}, True


def write_cache(logs):
    import tempfile
    temporary = None
    try:
        path = cache_path()
        folder = os.path.dirname(path)
        os.makedirs(folder, exist_ok=True)
        fd, temporary = tempfile.mkstemp(prefix='.codex-scan-', dir=folder)
        with os.fdopen(fd, 'w') as out:
            json.dump({'version': 1, 'logs': logs}, out, separators=(',', ':'))
        os.replace(temporary, path)
    except OSError:
        pass
    finally:
        if temporary:
            try:
                os.unlink(temporary)
            except OSError:
                pass


def scan(since_minutes=360, max_files=40):
    root = os.path.join(os.path.expanduser('~'), '.codex', 'sessions')
    now = time.time()
    cutoff = now - max(0, since_minutes) * 60
    logs, dirty = read_cache(now)
    candidates = []
    try:
        for folder, _, names in os.walk(root):
            for name in names:
                if not name.endswith('.jsonl'):
                    continue
                path = os.path.join(folder, name)
                try:
                    stat = os.stat(path)
                    if stat.st_mtime >= cutoff:
                        candidates.append((stat.st_mtime, path, stat))
                except OSError:
                    continue
    except OSError:
        return []
    runs = []
    for _, path, stat in sorted(candidates, key=lambda entry: entry[0], reverse=True)[:max(0, max_files)]:
        # Cache keys and replacement fingerprints reveal no log names or paths.
        key = hashlib.sha256(os.fsencode(path)).hexdigest()
        try:
            with open(path, 'rb') as stream:
                first_hash = hashlib.sha256(stream.readline()).hexdigest()
                previous = logs.get(key)
                if previous:
                    boundary = previous['size']
                    stream.seek(max(0, boundary - 128))
                    tail_hash = hashlib.sha256(stream.read(min(128, boundary))).hexdigest()
                    if stat.st_size < boundary or first_hash != previous['firstHash'] or tail_hash != previous.get('tailHash'):
                        previous = None
                stream.seek(max(0, stat.st_size - 128))
                current_tail = hashlib.sha256(stream.read(min(128, stat.st_size))).hexdigest()
            if previous and stat.st_size == previous['size']:
                entry = previous
                if now - entry['seenAt'] >= 60:
                    entry = {**entry, 'seenAt': now}
                    dirty = True
            else:
                parsed = parse_file(path, previous, stat.st_size)
                if parsed is None:
                    continue
                dirty = True
                entry = {**parsed, 'size': stat.st_size, 'firstHash': first_hash, 'tailHash': current_tail, 'seenAt': now}
            logs[key] = entry
            if entry['run']:
                runs.append(entry['run'])
        except (OSError, ValueError, TypeError, KeyError):
            continue
    if dirty:
        write_cache(logs)
    return sorted(runs, key=lambda run: (run['startedAt'], run['id']))


def main():
    since_minutes, max_files = 360, 40
    if len(sys.argv) > 1:
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument('--since-minutes', type=int, default=360)
        parser.add_argument('--max-files', type=int, default=40)
        args = parser.parse_args()
        since_minutes, max_files = args.since_minutes, args.max_files
    try:
        runs = scan(since_minutes, max_files)
    except Exception:
        runs = []
    print(json.dumps({'runs': runs}, separators=(',', ':')))


if __name__ == '__main__':
    main()
