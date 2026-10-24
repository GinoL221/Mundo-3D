'use strict';

// Explicitly invoked synthetic CLI: no application startup or database imports.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const [profile, ...args] = process.argv.slice(2);
const state = { calls: 0, records: ['retained'] };
process.on('exit', () => fs.writeSync(3, JSON.stringify(state) + '\n'));

function installed(name, version) {
  const hoisted = createRequire(path.join(root, 'node_modules/.pnpm/node_modules/fixture.cjs'));
  // Resolve the active dependency edge, never a stale virtual-store directory.
  const resolver =
    name === 'js-yaml' && version === '3.15.2'
      ? createRequire(hoisted.resolve('@istanbuljs/load-nyc-config/package.json'))
      : hoisted;
  const manifest = resolver.resolve(`${name}/package.json`);
  assert.equal(resolver(`${name}/package.json`).version, version);
  return path.dirname(fs.realpathSync(manifest));
}

if (profile === 'graph') {
  const consumers = [
    ['@rushstack/ts-command-line', '4.19.1'],
    ['js-yaml', '3.15.2'],
    ['js-yaml', '4.3.2'],
  ];
  const versions = consumers.map(([name, version]) => {
    const consumer = createRequire(path.join(installed(name, version), 'package.json'));
    return consumer('argparse/package.json').version;
  });
  process.stdout.write(JSON.stringify(versions) + '\n');
} else if (profile === 'yaml3' || profile === 'yaml4') {
  const version = profile === 'yaml3' ? '3.15.2' : '4.3.2';
  const directory = installed('js-yaml', version);
  process.argv = [process.execPath, 'js-yaml', ...args];
  require(path.join(directory, 'bin/js-yaml.js'));
} else if (profile === 'modern' || profile === 'legacy') {
  const consumer = createRequire(path.join(installed('js-yaml', '4.3.2'), 'package.json'));
  const { ArgumentParser } = consumer('argparse');
  const parser = new ArgumentParser({
    prog: 'fixture',
    ...(profile === 'legacy' ? { legacy_output: true } : {}),
  });
  parser.add_argument('--name', { required: true });
  const values = parser.parse_args(args);
  state.calls++;
  state.records.push(values.name);
  process.stdout.write(JSON.stringify(values) + '\n');
} else {
  const { CommandLineParser, CommandLineAction } = require(
    installed('@rushstack/ts-command-line', '4.19.1'),
  );
  class Action extends CommandLineAction {
    constructor() {
      super({
        actionName: 'run',
        summary: 'Run synthetic coverage',
        documentation: 'No database or production actions',
      });
    }
    onDefineParameters() {
      const define = (method, name, fields = {}) =>
        this[method]({
          parameterLongName: `--${name}`,
          description: `Synthetic ${name}`,
          ...fields,
        });
      if (profile === 'required') {
        this.first = define('defineStringParameter', 'first', {
          argumentName: 'FIRST',
          required: true,
        });
        this.second = define('defineStringParameter', 'second', {
          argumentName: 'SECOND',
          required: true,
        });
      } else if (profile === 'aliases') {
        this.enabled = define('defineFlagParameter', 'enabled', {
          parameterShortName: '-e',
          undocumentedSynonyms: ['--enable'],
        });
      } else if (profile === 'types') {
        this.mode = define('defineChoiceParameter', 'mode', {
          argumentName: 'MODE',
          alternatives: ['red', 'blue'],
          required: true,
        });
        this.count = define('defineIntegerParameter', 'count', {
          argumentName: 'COUNT',
          defaultValue: 3,
        });
      } else if (profile === 'lists') {
        this.numbers = define('defineIntegerListParameter', 'number', { argumentName: 'NUMBER' });
        this.colors = define('defineChoiceListParameter', 'color', {
          argumentName: 'COLOR',
          alternatives: ['red', 'blue'],
        });
      } else if (profile === 'env') {
        this.token = define('defineStringParameter', 'token', {
          argumentName: 'TOKEN',
          required: true,
          environmentVariable: 'FIXTURE_TOKEN',
          parameterGroup: 'fixture',
        });
      } else if (profile === 'remainder') {
        this.label = define('defineStringParameter', 'label', {
          argumentName: 'LABEL',
          defaultValue: 'fallback',
        });
        this.tail = this.defineCommandLineRemainder({ description: 'Synthetic remainder' });
      } else {
        throw new Error(`Unknown synthetic profile: ${profile}`);
      }
    }
    async onExecute() {
      const keys = {
        required: ['first', 'second'],
        aliases: ['enabled'],
        types: ['mode', 'count'],
        lists: ['numbers', 'colors'],
        env: ['token'],
        remainder: ['label', 'tail'],
      }[profile];
      const values = Object.fromEntries(
        keys.map((key) => [
          key,
          ['numbers', 'colors', 'tail'].includes(key) ? this[key].values : this[key].value,
        ]),
      );
      state.calls++;
      state.records.push(values);
      process.stdout.write(JSON.stringify(values) + '\n');
    }
  }
  const parser = new CommandLineParser({
    toolFilename: 'fixture',
    toolDescription: 'Synthetic coverage only',
  });
  if (profile === 'actionless') {
    const enabled = parser.defineFlagParameter({
      parameterLongName: '--enabled',
      description: 'Synthetic root flag',
    });
    parser.onExecute = async () => {
      const values = { enabled: enabled.value };
      state.calls++;
      state.records.push(values);
      process.stdout.write(JSON.stringify(values) + '\n');
    };
  } else {
    parser.addAction(new Action());
  }
  parser.execute(args).catch((error) => {
    process.stderr.write(String(error) + '\n');
    process.exitCode = 91;
  });
}
