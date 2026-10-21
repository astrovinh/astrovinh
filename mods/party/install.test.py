"""Installer checks: every run uses a temporary HOME, destination and fake git."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

INSTALLER = Path(__file__).with_name('install.sh').resolve()
DONE = 'Done. Type /reload-plugins in each Claude Code session you have open (or open a new one), then /party.'


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='party-installer-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.home = self.root / 'home'
        self.dest = self.root / 'repo with spaces'
        self.home.mkdir()
        self.settings = self.home / '.claude' / 'settings.json'
        self.log = self.root / 'git.jsonl'
        bindir = self.root / 'bin'
        bindir.mkdir()
        git = bindir / 'git'
        git.write_text('''#!/usr/bin/env python3
import json, os, pathlib, sys
args = sys.argv[1:]
with open(os.environ['PARTY_INSTALL_GIT_LOG'], 'a') as log:
    log.write(json.dumps(args) + '\\n')
if args[:1] == ['clone']:
    dest = pathlib.Path(args[-1])
    (dest / '.git').mkdir(parents=True)
    (dest / 'mods' / 'party').mkdir(parents=True)
if os.environ.get('PARTY_INSTALL_GIT_FAIL') and args[:1] != ['--version']:
    sys.exit(7)
''')
        git.chmod(0o755)
        self.env = {**os.environ, 'HOME': str(self.home), 'MURROR_PARTY_DEST': str(self.dest),
                    'PATH': str(bindir) + os.pathsep + os.environ['PATH'], 'PARTY_INSTALL_GIT_LOG': str(self.log)}

    def run_installer(self, success=True):
        result = subprocess.run(['bash', str(INSTALLER)], env=self.env, text=True, capture_output=True)
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        return result

    def seed_settings(self, data):
        self.settings.parent.mkdir(exist_ok=True)
        self.settings.write_text(json.dumps(data) + '\n')
        return self.settings.read_bytes()

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def backups(self):
        return sorted(self.settings.parent.glob('settings.json.before-murror-party-*'))

    def test_clean_clone_adds_only_party_and_prints_exact_reload_message(self):
        result = self.run_installer()
        self.assertEqual(json.loads(self.settings.read_text()), {'env': {'CLAUDE_CODE_PLUGIN_DIRS': str(self.dest / 'mods/party')}})
        self.assertEqual(self.calls(), [['--version'], ['clone', '--branch', 'claude/usage-bars-mod', 'https://github.com/astrovinh/astrovinh', str(self.dest)]])
        self.assertEqual(result.stdout.strip(), DONE)
        self.assertEqual(self.backups(), [])

    def test_existing_settings_are_backed_up_once_and_reinstall_is_idempotent(self):
        original = self.seed_settings({'theme': 'dark', 'env': {'KEEP': 'yes', 'CLAUDE_CODE_PLUGIN_DIRS': '/first:/second'}})
        self.run_installer()
        self.assertEqual(len(self.backups()), 1)
        self.assertEqual(self.backups()[0].read_bytes(), original)
        self.run_installer()
        self.assertEqual(len(self.backups()), 1)
        self.assertEqual(json.loads(self.settings.read_text()), {'theme': 'dark', 'env': {'KEEP': 'yes', 'CLAUDE_CODE_PLUGIN_DIRS': '/first:/second:' + str(self.dest / 'mods/party')}})
        self.assertEqual(self.calls()[-4:], [['--version'], ['-C', str(self.dest), 'fetch', 'origin', 'claude/usage-bars-mod'], ['-C', str(self.dest), 'checkout', 'claude/usage-bars-mod'], ['-C', str(self.dest), 'pull', '--ff-only', 'origin', 'claude/usage-bars-mod']])

    def test_already_listed_plugin_never_creates_a_backup_or_duplicate(self):
        self.seed_settings({'env': {'CLAUDE_CODE_PLUGIN_DIRS': '/first:' + str(self.dest / 'mods/party')}})
        self.run_installer()
        self.assertEqual(self.backups(), [])
        self.assertEqual(json.loads(self.settings.read_text())['env']['CLAUDE_CODE_PLUGIN_DIRS'].split(os.pathsep), ['/first', str(self.dest / 'mods/party')])

    def test_non_repo_destination_is_refused_without_touching_settings(self):
        original = self.seed_settings({'keep': True})
        self.dest.mkdir()
        result = self.run_installer(False)
        self.assertIn('MURROR_PARTY_DEST', result.stdout)
        self.assertEqual(self.settings.read_bytes(), original)
        self.assertEqual(self.backups(), [])

    def test_git_failure_does_not_touch_settings(self):
        original = self.seed_settings({'keep': True})
        self.env['PARTY_INSTALL_GIT_FAIL'] = '1'
        self.run_installer(False)
        self.assertEqual(self.settings.read_bytes(), original)
        self.assertEqual(self.backups(), [])

    def test_invalid_json_is_backed_up_and_never_overwritten(self):
        self.settings.parent.mkdir()
        self.settings.write_text('{invalid')
        self.run_installer(False)
        self.assertEqual(self.settings.read_text(), '{invalid')
        self.assertEqual(len(self.backups()), 1)
        self.assertEqual(self.backups()[0].read_text(), '{invalid')


if __name__ == '__main__':
    unittest.main(verbosity=2)
