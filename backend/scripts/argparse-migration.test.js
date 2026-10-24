'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { test } = require('node:test');
const fixture = path.join(__dirname, 'argparse-cli-fixture.cjs');
const root = path.resolve(__dirname, '../..');
const initial = { calls: 0, records: ['retained'] };

function run(profile, args = [], input = '', env = {}) {
  const result = spawnSync(process.execPath, [fixture, profile, ...args], {
    cwd: root,
    input,
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C', TERM: 'dumb', NO_COLOR: '1', ...env },
  });
  assert.equal(result.error, undefined, `${profile}: child error`);
  assert.equal(result.signal, null, `${profile}: child signal`);
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    state: JSON.parse(result.output[3]),
  };
}

function expectRun(profile, args, expected, input = '', env = {}) {
  assert.deepEqual(run(profile, args, input, env), {
    ...expected,
    state: expected.state || initial,
  });
}

test('both migrated consumers and unchanged YAML4 resolve argparse v2', () => {
  expectRun('graph', [], { status: 0, stdout: '["2.0.1","2.0.1","2.0.1"]\n', stderr: '' });
});

const typesUsage = 'usage: fixture run [-h] --mode {red,blue} [--count COUNT]\n';
const listsUsage = 'usage: fixture run [-h] [--number NUMBER] [--color {red,blue}]\n';
const aliasesHelp =
  'usage: fixture run [-h] [-e]\n\nNo database or production actions\n\nOptional arguments:\n  -h, --help     Show this help message and exit.\n  -e, --enabled  Synthetic enabled\n';
const envHelp =
  'usage: fixture run [-h] [--token TOKEN]\n\nNo database or production actions\n\nOptional arguments:\n  -h, --help     Show this help message and exit.\n\nOptional fixture arguments:\n  --token TOKEN  Synthetic token. This parameter may alternatively be \n                 specified via the FIXTURE_TOKEN environment variable.\n';
const remainderHelp =
  'usage: fixture run [-h] [--label LABEL] ...\n\nNo database or production actions\n\nPositional arguments:\n  "..."          Synthetic remainder\n\nOptional arguments:\n  -h, --help     Show this help message and exit.\n  --label LABEL  Synthetic label. The default value is "fallback".\n';

for (const [profile, args, stdout, diagnostic] of [
  [
    'types',
    ['run', '--mode', 'green'],
    typesUsage,
    'argument "--mode": Invalid choice: green (choose from [red, blue])',
  ],
  [
    'types',
    ['run', '--mode', 'red', '--count', 'bad'],
    typesUsage,
    'argument "--count": Invalid int value: bad',
  ],
  ['types', ['run'], typesUsage, 'Argument "--mode" is required'],
  ['lists', ['run', '--number', 'bad'], listsUsage, 'argument "--number": Invalid int value: bad'],
  [
    'lists',
    ['run', '--color', 'green'],
    listsUsage,
    'argument "--color": Invalid choice: green (choose from [red, blue])',
  ],
  ['env', ['run'], 'usage: fixture run [-h] --token TOKEN\n', 'Argument "--token" is required'],
]) {
  test(`Rush preserves rejected ${profile} ${args.join(' ')}`, () => {
    expectRun(profile, args, {
      status: 2,
      stdout,
      stderr: `fixture run: error: ${diagnostic}\n\n`,
    });
  });
}

test('Rush reports every missing required parameter without executing the action', () => {
  expectRun('required', ['run'], {
    status: 2,
    stdout: 'usage: fixture run [-h] --first FIRST --second SECOND\n',
    stderr:
      'fixture run: error: Argument "--first" is required\nArgument "--second" is required\n\n',
  });
});

for (const [profile, stdout] of [
  ['aliases', aliasesHelp],
  ['env', envHelp],
  ['remainder', remainderHelp],
]) {
  test(`Rush preserves ${profile} help and does not execute actions`, () => {
    expectRun(profile, ['run', '--help'], { status: 0, stdout, stderr: '' });
  });
}

test('Rush rejects unknown child options using child usage', () => {
  expectRun('aliases', ['run', '--unknown'], {
    status: 2,
    stdout: 'usage: fixture run [-h] [-e]\n',
    stderr: 'fixture run: error: Unrecognized arguments: --unknown.\n\n',
  });
});

test('Rush preserves unknown root diagnostics', () => {
  expectRun('remainder', ['--unknown'], {
    status: 2,
    stdout: 'usage: fixture [-h] <command> ...\n',
    stderr: 'fixture: error: too few arguments\n\n',
  });
});

for (const [profile, args, values, env] of [
  ['required', ['run', '--first', 'one', '--second', 'two'], { first: 'one', second: 'two' }, {}],
  ['aliases', ['run', '--enable'], { enabled: true }, {}],
  ['types', ['run', '--mode', 'blue'], { mode: 'blue', count: 3 }, {}],
  [
    'lists',
    ['run', '--number', '7', '--number', '8', '--color', 'red'],
    { numbers: [7, 8], colors: ['red'] },
    {},
  ],
  ['env', ['run'], { token: 'synthetic' }, { FIXTURE_TOKEN: 'synthetic' }],
  [
    'remainder',
    ['run', '--', '--option-looking'],
    { label: 'fallback', tail: ['--', '--option-looking'] },
    {},
  ],
]) {
  test(`Rush executes ${profile} once with parsed values`, () => {
    expectRun(
      profile,
      args,
      {
        status: 0,
        stdout: JSON.stringify(values) + '\n',
        stderr: '',
        state: { calls: 1, records: ['retained', values] },
      },
      '',
      env,
    );
  });
}

test('Rush preserves actionless root parsing and rejects extras without executing', () => {
  expectRun('actionless', ['--enabled'], {
    status: 0,
    stdout: '{"enabled":true}\n',
    stderr: '',
    state: { calls: 1, records: ['retained', { enabled: true }] },
  });
  expectRun('actionless', ['--unknown'], {
    status: 2,
    stdout: 'usage: fixture [-h] [--enabled]\n',
    stderr: 'fixture: error: Unrecognized arguments: --unknown.\n\n',
  });
});

test('argparse modern output remains the default for other consumers', () => {
  expectRun('modern', [], {
    status: 2,
    stdout: '',
    stderr:
      'usage: fixture [-h] --name NAME\nfixture: error: the following arguments are required: --name\n',
  });
});

test('argparse legacy output requires explicit opt-in', () => {
  expectRun('legacy', [], {
    status: 2,
    stdout: 'usage: fixture [-h] --name NAME\n',
    stderr: 'fixture: error: Argument "--name" is required\n',
  });
});

const yamlUsage = 'usage: js-yaml [-h] [-v] [-c] [-t] [file]\n';
const yamlLegacyHelp =
  yamlUsage +
  "\nPositional arguments:\n  file           File to read, utf-8 encoded without BOM\n\nOptional arguments:\n  -h, --help     Show this help message and exit.\n  -v, --version  Show program's version number and exit.\n  -c, --compact  Display errors in compact mode\n  -t, --trace    Show stack trace on error\n";
const yamlModernHelp =
  yamlUsage +
  "\npositional arguments:\n  file           File to read, utf-8 encoded without BOM\n\noptional arguments:\n  -h, --help     show this help message and exit\n  -v, --version  show program's version number and exit\n  -c, --compact  Display errors in compact mode\n  -t, --trace    Show stack trace on error\n";

for (const [profile, version, help] of [
  ['yaml3', '3.15.2', yamlLegacyHelp],
  ['yaml4', '4.3.2', yamlModernHelp],
]) {
  for (const flag of ['--help', '-cth']) {
    test(`${profile} preserves ${flag} output`, () => {
      expectRun(profile, [flag], { status: 0, stdout: help, stderr: '' });
    });
  }
  for (const flag of ['-v', '--version']) {
    test(`${profile} preserves ${flag} output`, () => {
      expectRun(profile, [flag], { status: 0, stdout: version + '\n', stderr: '' });
    });
  }
  test(`${profile} preserves invalid-option streams`, () => {
    expectRun(profile, ['--invalid-option'], {
      status: 2,
      stdout: profile === 'yaml3' ? yamlUsage : '',
      stderr:
        profile === 'yaml3'
          ? 'js-yaml: error: Unrecognized arguments: --invalid-option.\n'
          : yamlUsage + 'js-yaml: error: unrecognized arguments: --invalid-option\n',
    });
  });
  test(`${profile} grouped trace flags preserve full diagnostic bytes`, () => {
    const separate = run(profile, ['-c', '-t'], 'value: [unterminated\n');
    assert.equal(separate.status, 1);
    assert.equal(separate.stdout, '');
    assert.deepEqual(separate.state, initial);
    assert.match(separate.stderr, /YAMLException:/);
    assert.match(separate.stderr, /\n    at /);
    assert.deepEqual(run(profile, ['-ct'], 'value: [unterminated\n'), separate);
  });
}
