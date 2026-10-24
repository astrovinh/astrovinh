"""Synthetic fixtures only. Never include real session content."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import importlib.util
from unittest.mock import patch
import unittest
from datetime import datetime, timezone

SCANNER = Path(__file__).with_name("codex_scan.py")

class ScanTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name)
        self.folder = self.home / '.codex' / 'sessions' / '2026' / '10' / '24'
        self.folder.mkdir(parents=True)

    def write(self, events, name='synthetic.jsonl'):
        p = self.folder / name
        p.write_text('\n'.join(json.dumps(e) if isinstance(e, dict) else e for e in events) + '\n')
        return p

    def event(self, kind, payload, seconds=0):
        return {'timestamp': f'2026-10-24T12:00:{seconds:02d}Z', 'type': kind, 'payload': payload}

    def meta(self, id='run-1', source='exec'):
        return self.event('session_meta', {'id': id, 'source': source, 'cwd': '/synthetic/private'})

    def scan(self, *args):
        r = subprocess.run(['python3', str(SCANNER), '--since-minutes', '10000000', *args], env={**os.environ, 'HOME': str(self.home)}, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0)
        self.assertEqual(r.stderr, '')
        return json.loads(r.stdout)

    def test_empty_home(self):
        with tempfile.TemporaryDirectory() as root:
            result = subprocess.run(["python3", str(SCANNER)], env={**os.environ, "HOME": root}, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0)
            self.assertEqual(json.loads(result.stdout), {"runs": []})

    def test_counts_completion_and_tokens(self):
        self.write([self.meta(), self.event('response_item', {'type': 'custom_tool_call', 'name': 'exec', 'input': 'SYNTHETIC_SECRET'}, 1), self.event('response_item', {'type': 'function_call', 'name': 'spawn_agent'}, 2), self.event('response_item', {'type': 'custom_tool_call', 'name': 'other'}, 3), self.event('event_msg', {'type': 'token_count', 'info': {'total_token_usage': {'total_tokens': 71}}}, 4), self.event('event_msg', {'type': 'task_complete'}, 5)])
        r = self.scan()['runs'][0]
        self.assertEqual((r['cmds'], r['spawned'], r['done'], r['tokens']), (1, 1, True, 71))
        self.assertEqual(r['lastAt'] - r['startedAt'], 5000)

    def test_any_newer_event_clears_done(self):
        self.write([self.meta(), self.event('event_msg', {'type': 'task_complete'}, 1), self.event('world_state', {}, 2)])
        self.assertFalse(self.scan()['runs'][0]['done'])

    def test_nesting_uses_subagent_thread_spawn(self):
        self.write([self.meta('helper-1', {'subagent': {'thread_spawn': {'parent_thread_id': 'run-1', 'agent_role': 'sentinel', 'agent_nickname': 'Review', 'depth': 1}}})])
        r = self.scan()['runs'][0]
        self.assertEqual((r['id'], r['parentId'], r['kind'], r['role'], r['nickname']), ('helper-1', 'run-1', 'helper', 'sentinel', 'Review'))

    def test_label_only_from_first_user_message(self):
        for text, label in [('Implement task-38-brief.md exactly', 'task-38'), ('Read brief.md', 'brief'), ('No matching name', None)]:
            self.write([self.meta(), self.event('response_item', {'type': 'message', 'role': 'user', 'content': [{'type': 'input_text', 'text': text}]}, 1), self.event('response_item', {'type': 'message', 'role': 'user', 'content': [{'type': 'input_text', 'text': 'task-99-brief.md'}]}, 2)])
            self.assertEqual(self.scan()['runs'][0]['label'], label)

    def test_privacy_output_is_only_allowlisted_facts(self):
        secret = 'SYNTHETIC_SECRET_923_TOKEN'
        self.write([self.meta(), self.event('response_item', {'type': 'message', 'role': 'user', 'content': [{'type': 'input_text', 'text': secret + ' /synthetic/top-secret/task-38-brief.md'}]}, 1), self.event('response_item', {'type': 'custom_tool_call', 'name': 'exec', 'input': secret}, 2), self.event('event_msg', {'type': 'task_complete', 'last_agent_message': secret}, 3)])
        out = self.scan()
        self.assertNotIn(secret, json.dumps(out))
        self.assertNotIn('/synthetic', json.dumps(out))
        self.assertEqual(set(out), {'runs'})
        self.assertEqual(set(out['runs'][0]), {'id', 'parentId', 'kind', 'role', 'nickname', 'label', 'startedAt', 'lastAt', 'cmds', 'spawned', 'done', 'tokens'})

    def test_corrupt_odd_and_empty_files_skip_silently(self):
        self.write(['{broken', 'null', '[]', self.meta(), {'payload': []}, self.event('event_msg', {'type': 'task_complete'}, 1)])
        self.write([], 'empty.jsonl')
        self.assertEqual(len(self.scan()['runs']), 1)

    def module(self):
        spec = importlib.util.spec_from_file_location('codex_scan_test', SCANNER)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_unchanged_scan_does_not_parse_again(self):
        self.write([self.meta()])
        module = self.module()
        with patch.dict(os.environ, HOME=str(self.home)), patch.object(module, 'parse_file', wraps=module.parse_file) as parse:
            first = module.scan(10000000)
            self.assertEqual(parse.call_count, 1)
            self.assertEqual(module.scan(10000000), first)
            self.assertEqual(parse.call_count, 1)

    def test_unchanged_scan_does_not_rewrite_fresh_cache(self):
        self.write([self.meta()])
        module = self.module()
        with patch.dict(os.environ, HOME=str(self.home)), patch.object(module, 'write_cache', wraps=module.write_cache) as write:
            module.scan(10000000)
            self.assertEqual(write.call_count, 1)
            module.scan(10000000)
            self.assertEqual(write.call_count, 1)

    def test_appends_read_only_new_bytes_and_update_done(self):
        p = self.write([self.meta(), self.event('response_item', {'type': 'custom_tool_call', 'name': 'exec'}, 1)])
        module = self.module()
        with patch.dict(os.environ, HOME=str(self.home)):
            self.assertEqual(module.scan(10000000)[0]['cmds'], 1)
            with p.open('a') as out:
                out.write(json.dumps(self.event('event_msg', {'type': 'task_complete'}, 2)) + '\n')
            with patch.object(module.json, 'loads', wraps=module.json.loads) as loads:
                run = module.scan(10000000)[0]
                # One cache object and one appended record, never the old log records.
                self.assertLessEqual(loads.call_count, 2)
            self.assertEqual((run['cmds'], run['done']), (1, True))
            with p.open('a') as out:
                out.write(json.dumps(self.event('response_item', {'type': 'custom_tool_call', 'name': 'exec'}, 3)) + '\n')
            self.assertEqual((module.scan(10000000)[0]['cmds'], module.scan(10000000)[0]['done']), (2, False))

    def test_truncation_and_same_size_replacement_restart(self):
        self.write([self.meta('old-1'), self.event('response_item', {'type': 'custom_tool_call', 'name': 'exec'}, 1)])
        self.scan()
        p = self.write([self.meta('new-1')])
        self.assertEqual(self.scan()['runs'][0]['id'], 'new-1')
        stamp = p.stat().st_mtime_ns
        self.write([self.meta('new-2')])
        os.utime(p, ns=(stamp, stamp))
        self.assertEqual(self.scan()['runs'][0]['id'], 'new-2')
        self.assertEqual(self.scan()['runs'][0]['cmds'], 0)

    def test_corrupt_cache_is_ignored(self):
        cache = self.home / '.cache' / 'party' / 'codex-scan.json'
        cache.parent.mkdir(parents=True)
        cache.write_text('{broken')
        self.write([self.meta()])
        self.assertEqual(len(self.scan()['runs']), 1)
        self.assertIsInstance(json.loads(cache.read_text()), dict)

    def test_cache_never_retains_content_or_log_paths(self):
        secret = 'SYNTHETIC_CACHE_SECRET'
        self.write([self.meta(), self.event('response_item', {'type': 'message', 'role': 'user', 'content': [{'text': secret}]}, 1), self.event('response_item', {'type': 'custom_tool_call', 'name': 'exec', 'input': secret}, 2)])
        self.scan()
        cache = (self.home / '.cache' / 'party' / 'codex-scan.json').read_text()
        self.assertNotIn(secret, cache)
        self.assertNotIn(str(self.home), cache)
        self.assertNotIn('synthetic.jsonl', cache)
        self.assertNotIn('/synthetic', cache)
        # An appended second user message must not change a null first label.
        with (self.folder / 'synthetic.jsonl').open('a') as out:
            out.write(json.dumps(self.event('response_item', {'type': 'message', 'role': 'user', 'content': [{'text': 'task-99-brief.md'}]}, 3)) + '\n')
        self.assertIsNone(self.scan()['runs'][0]['label'])

    def test_concurrent_scans_leave_valid_cache(self):
        self.write([self.meta()])
        args = ['python3', str(SCANNER), '--since-minutes', '10000000']
        env = {**os.environ, 'HOME': str(self.home)}
        processes = [subprocess.Popen(args, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE) for _ in range(2)]
        for process in processes:
            out, err = process.communicate(timeout=5)
            self.assertEqual(process.returncode, 0)
            self.assertEqual(err, b'')
            self.assertEqual(len(json.loads(out)['runs']), 1)
        self.assertIsInstance(json.loads((self.home / '.cache' / 'party' / 'codex-scan.json').read_text()), dict)
        self.assertEqual(len(self.scan()['runs']), 1)

    def test_incomplete_appended_record_is_read_after_newline(self):
        p = self.write([self.meta()])
        self.scan()
        record = json.dumps(self.event('response_item', {'type': 'custom_tool_call', 'name': 'exec'}, 1))
        with p.open('a') as out:
            out.write(record[:30])
        self.assertEqual(self.scan()['runs'][0]['cmds'], 0)
        with p.open('a') as out:
            out.write(record[30:] + '\n')
        self.assertEqual(self.scan()['runs'][0]['cmds'], 1)

    def test_valid_json_cache_with_invalid_values_is_ignored(self):
        self.write([self.meta()])
        self.scan()
        cache = self.home / '.cache' / 'party' / 'codex-scan.json'
        original = json.loads(cache.read_text())
        for field, value in [('cmds', 'SYNTHETIC_SECRET'), ('startedAt', float('nan')), ('done', 1), ('id', None), ('tokens', -1)]:
            data = json.loads(json.dumps(original))
            next(iter(data['logs'].values()))['run'][field] = value
            cache.write_text(json.dumps(data))
            self.assertEqual(self.scan()['runs'][0]['cmds'], 0)
            self.assertEqual(self.scan()['runs'][0]['id'], 'run-1')
        data = json.loads(json.dumps(original))
        next(iter(data['logs'].values()))['seenAt'] = float('inf')
        cache.write_text(json.dumps(data))
        self.scan()
        self.assertNotIn('Infinity', cache.read_text())

    def test_unbounded_cache_numbers_are_ignored_and_repaired(self):
        self.write([self.meta()])
        self.scan()
        cache = self.home / '.cache' / 'party' / 'codex-scan.json'
        original = cache.read_text()
        for field in ['seenAt', 'size', 'offset']:
            data = json.loads(original)
            next(iter(data['logs'].values()))[field] = 10 ** 1000
            cache.write_text(json.dumps(data))
            self.assertEqual(len(self.scan()['runs']), 1)
            self.assertNotIn(str(10 ** 1000), cache.read_text())

    def test_growth_during_scan_preserves_incremental_boundary(self):
        p = self.write([self.meta()])
        module = self.module()
        parse = module.parse_file
        def grow(*args, **kwargs):
            with p.open('a') as out:
                out.write(json.dumps(self.event('response_item', {'type': 'custom_tool_call', 'name': 'exec'}, 1)) + '\n')
            return parse(*args, **kwargs)
        with patch.dict(os.environ, HOME=str(self.home)), patch.object(module, 'parse_file', side_effect=grow):
            module.scan(10000000)
        data = json.loads((self.home / '.cache' / 'party' / 'codex-scan.json').read_text())
        entry = next(iter(data['logs'].values()))
        self.assertLessEqual(entry['offset'], entry['size'])
        with patch.dict(os.environ, HOME=str(self.home)), patch.object(module.json, 'loads', wraps=module.json.loads) as loads:
            self.assertEqual(module.scan(10000000)[0]['cmds'], 1)
            self.assertLessEqual(loads.call_count, 2)

    def test_cache_drops_entries_unseen_for_a_day(self):
        self.write([self.meta()])
        self.scan()
        cache = self.home / '.cache' / 'party' / 'codex-scan.json'
        data = json.loads(cache.read_text())
        old = next(iter(data['logs'].values())).copy()
        old['seenAt'] = 1
        data['logs']['0' * 64] = old
        cache.write_text(json.dumps(data))
        self.scan()
        self.assertEqual(len(json.loads(cache.read_text())['logs']), 1)

    def test_max_files_and_start_sort(self):
        self.write([self.meta('id-2'), self.event('world_state', {}, 4)], 'b.jsonl')
        self.write([self.meta('id-1')], 'a.jsonl')
        self.assertEqual(len(self.scan('--max-files', '1')['runs']), 1)
        self.assertEqual(len(self.scan()['runs']), 2)

if __name__ == "__main__":
    unittest.main()
