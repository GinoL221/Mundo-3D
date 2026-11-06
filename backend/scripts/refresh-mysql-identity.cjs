'use strict';

// Comparison only: callers must obtain expected IDs from their own authorized
// creation and observed data from trusted Docker inspection. This function does
// not establish ownership, authorize operations, or connect to MySQL.
function verifyContainer(observed, expected) {
  if (!expected || !/^[a-f0-9]{64}(?![\s\S])/.test(expected.id || '') ||
      !/^sha256:[a-f0-9]{64}(?![\s\S])/.test(expected.image || '') ||
      !/^[a-f0-9]{32}(?![\s\S])/.test(expected.run || '') ||
      !/^m3d-refresh-test-[a-z0-9-]+(?![\s\S])/.test(expected.volume || '') ||
      !/^[1-9][0-9]{0,4}(?![\s\S])/.test(expected.port || '') || Number(expected.port) > 65535) return false;
  const ports = observed?.NetworkSettings?.Ports;
  const bindings = ports?.['3306/tcp'];
  return observed?.Id === expected.id && observed.Image === expected.image &&
    observed.State?.Running === true && observed.HostConfig?.NetworkMode === 'bridge' &&
    observed.Config?.Labels?.['m3d.refresh.run'] === expected.run &&
    Array.isArray(observed.Mounts) && observed.Mounts.length === 1 &&
    observed.Mounts[0]?.Type === 'volume' && observed.Mounts[0]?.Name === expected.volume &&
    observed.Mounts[0]?.Destination === '/var/lib/mysql' &&
    ports != null && Object.keys(ports).length === 1 && Array.isArray(bindings) &&
    bindings.length === 1 && bindings[0]?.HostIp === '127.0.0.1' && bindings[0]?.HostPort === expected.port;
}
module.exports = { verifyContainer };
