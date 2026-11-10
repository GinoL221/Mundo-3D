'use strict';
const { reconcileCreationEvidence } = require('./refresh-mysql-creation-evidence.cjs');
const MYSQL_IMAGE = 'mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b';
// Digest of the v1.28.2 image already used by docker-compose.yml, pinned so the
// bound container cannot silently run a retagged image.
const MAILPIT_IMAGE = 'axllent/mailpit@sha256:28a161f4a39c70671d0fb771a6e7a3abe6d2144c0e2a595ff72767ab63cd14f6';
const ID = /^[a-f0-9]{64}(?![\s\S])/;
const RUN = /^[a-f0-9]{32}(?![\s\S])/;
const PORT = /^[1-9][0-9]{0,4}(?![\s\S])/;

function assertResourceBinding(record, inspected, requireRunning = false) {
  const reject = () => { throw new Error('E2E resource binding rejected'); };
  if (!record || !ID.test(record.containerId || '') || !RUN.test(record.runId || '') ||
      !['mysql', 'mailpit'].includes(record.kind) || !inspected || inspected.Id !== record.containerId ||
      inspected.Name !== `/m3d-e2e-${record.kind}-${record.runId}` ||
      inspected.Config?.Labels?.['m3d.e2e.run'] !== record.runId ||
      inspected.Config?.Labels?.['m3d.e2e.kind'] !== record.kind ||
      inspected.Config?.Image !== (record.kind === 'mysql' ? MYSQL_IMAGE : MAILPIT_IMAGE)) reject();
  const result = {};
  if (record.kind === 'mysql') {
    const evidence = reconcileCreationEvidence({ createdContainerId: record.containerId, inspectedContainer: inspected });
    if (evidence.status !== 'confirmed' || record.volumeName && record.volumeName !== evidence.volumeName) reject();
    result.volumeName = evidence.volumeName;
  } else if (!Array.isArray(inspected.Mounts) || inspected.Mounts.length !== 0) reject();
  if (requireRunning) {
    if (inspected.State?.Running !== true) reject();
    const expected = record.kind === 'mysql' ? { '3306/tcp': 'dbPort' }
      : { '8025/tcp': 'httpPort', '1025/tcp': 'smtpPort' };
    for (const [key, value] of Object.entries(inspected.NetworkSettings?.Ports || {})) {
      if (!Object.hasOwn(expected, key) && value?.length) reject();
    }
    for (const [key, field] of Object.entries(expected)) {
      const bindings = inspected.NetworkSettings?.Ports?.[key];
      if (!Array.isArray(bindings) || bindings.length !== 1 || bindings[0].HostIp !== '127.0.0.1' ||
          !PORT.test(bindings[0].HostPort || '') || Number(bindings[0].HostPort) > 65535) reject();
      result[field] = bindings[0].HostPort;
    }
  }
  return Object.freeze(result);
}
module.exports = { assertResourceBinding, MYSQL_IMAGE, MAILPIT_IMAGE };
