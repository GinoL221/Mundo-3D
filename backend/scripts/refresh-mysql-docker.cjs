'use strict';
const { verifyContainer } = require('./refresh-mysql-identity.cjs');
const FULL_ID = /^[a-f0-9]{64}(?![\s\S])/;

// Preparation only: never select or invoke a real process executor by default.
function createDockerAdapter(execute) {
  if (typeof execute !== 'function') throw new TypeError('Process executor is required');
  const invoke = async (args) => {
    const result = await execute(Object.freeze([...args]));
    if (!result || result.code !== 0 || result.stderr !== '') throw new Error('Docker command failed or produced stderr; resources preserved');
    return result;
  };
  return Object.freeze({
    async create(config) {
      void config;
      throw new Error('Docker creation disabled: no trusted volume freshness proof is available');
    },
    async inspectContainer(id) {
      if (typeof id !== 'string' || !FULL_ID.test(id)) throw new TypeError('Exact container ID required');
      const result = await invoke(['inspect', '--type', 'container', id]);
      let values;
      try { values = JSON.parse(result.stdout); } catch { throw new Error('Docker inspect output invalid'); }
      if (!Array.isArray(values) || values.length !== 1) throw new Error('Docker inspect output ambiguous');
      const raw = values[0];
      return { id: raw?.Id, containerName: raw?.Name?.replace(/^\//, ''), volumeName: raw?.Mounts?.length === 1 ? raw.Mounts[0].Name : undefined,
        port: raw?.NetworkSettings?.Ports?.['3306/tcp']?.length === 1 ? raw.NetworkSettings.Ports['3306/tcp'][0].HostPort : undefined,
        imageId: raw?.Image, runId: raw?.Config?.Labels?.['m3d.refresh.run'], dockerInspection: raw };
    },
    async inspectVolume(id) {
      if (typeof id !== 'string' || !(FULL_ID.test(id) || /^m3d-refresh-test-[a-z0-9-]+(?![\s\S])/.test(id))) throw new TypeError('Exact volume name required');
      const result = await invoke(['volume', 'inspect', id]);
      let values;
      try { values = JSON.parse(result.stdout); } catch { throw new Error('Docker volume inspect output invalid'); }
      if (!Array.isArray(values) || values.length !== 1) throw new Error('Docker volume inspect output ambiguous');
      return { id: values[0]?.Name, name: values[0]?.Name, runId: values[0]?.Labels?.['m3d.refresh.run'] };
    },
    verifyInspection(observed, expected) {
      return verifyContainer(observed?.dockerInspection, expected);
    },
  });
}
// Pure transcript simulation: no executor, process, work callback, or cleanup.
// Observed names and IDs are diagnostic evidence, not ownership proof.
function simulateAnonymousCreation(config, responses) {
  const calls = [];
  let containerId = null;
  let volumeName = null;
  const containerIds = new Set();
  const volumeNames = new Set();
  const fail = () => {
    const error = new Error('Anonymous creation simulation uncertain; preserve resources for human intervention');
    error.evidence = Object.freeze({ containerId, volumeName });
    // Candidates are untrusted diagnostics only, never cleanup authority.
    error.untrustedCandidates = Object.freeze({ containerIds: Object.freeze([...containerIds]), volumeNames: Object.freeze([...volumeNames]) });
    error.calls = Object.freeze(calls.map(args => Object.freeze([...args])));
    throw error;
  };
  if (!config || !/^m3d-refresh-test-[a-z0-9-]+(?![\s\S])/.test(config.containerName || '') ||
      !/^[a-f0-9]{32}(?![\s\S])/.test(config.runId || '') ||
      !/^sha256:[a-f0-9]{64}(?![\s\S])/.test(config.imageId || '') ||
      !/^[1-9][0-9]{0,4}(?![\s\S])/.test(config.port || '') || Number(config.port) > 65535 ||
      !Array.isArray(responses)) fail();
  calls.push(['create', '--name', config.containerName, '--label', `m3d.refresh.run=${config.runId}`,
    '--network', 'bridge', '--publish', `127.0.0.1:${config.port}:3306`, '--mount', 'type=volume,dst=/var/lib/mysql', config.imageId]);
  const created = responses[0];
  if (typeof created?.stdout === 'string') {
    for (const line of created.stdout.split('\n')) if (FULL_ID.test(line)) containerIds.add(line);
  }
  if (!created || created.code !== 0 || created.stderr !== '' || typeof created.stdout !== 'string' ||
      !/^[a-f0-9]{64}\n?(?![\s\S])/.test(created.stdout)) fail();
  containerId = created.stdout.replace(/\n$/, '');
  calls.push(['inspect', '--type', 'container', containerId]);
  const inspected = responses[1];
  let objects;
  try { objects = JSON.parse(inspected?.stdout); } catch { /* No parsable diagnostic candidates. */ }
  if (Array.isArray(objects)) {
    for (const item of objects) {
      if (typeof item?.Id === 'string' && FULL_ID.test(item.Id)) containerIds.add(item.Id);
      if (Array.isArray(item?.Mounts)) for (const mount of item.Mounts) {
        if (typeof mount?.Name === 'string' && FULL_ID.test(mount.Name)) volumeNames.add(mount.Name);
      }
    }
  }
  if (!inspected || inspected.code !== 0 || inspected.stderr !== '' || !Array.isArray(objects) || objects.length !== 1) fail();
  const raw = objects[0];
  const mounts = raw?.Mounts;
  const ports = raw?.HostConfig?.PortBindings;
  const binding = ports?.['3306/tcp'];
  if (raw?.Id !== containerId || raw?.Name !== `/${config.containerName}` || raw?.Image !== config.imageId ||
      raw?.Config?.Labels?.['m3d.refresh.run'] !== config.runId || raw?.HostConfig?.NetworkMode !== 'bridge' ||
      !ports || Object.keys(ports).length !== 1 || !Array.isArray(binding) || binding.length !== 1 ||
      binding[0]?.HostIp !== '127.0.0.1' || binding[0]?.HostPort !== config.port ||
      !Array.isArray(mounts) || mounts.length !== 1 || mounts[0]?.Type !== 'volume' ||
      mounts[0]?.Destination !== '/var/lib/mysql' || mounts[0]?.RW !== true ||
      typeof mounts[0]?.Name !== 'string' || !FULL_ID.test(mounts[0].Name)) fail();
  volumeName = mounts[0].Name;
  return Object.freeze({ evidence: Object.freeze({ containerId, volumeName }), calls: Object.freeze(calls.map(args => Object.freeze(args))) });
}
module.exports = { createDockerAdapter, simulateAnonymousCreation };
