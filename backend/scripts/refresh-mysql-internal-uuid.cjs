'use strict';
const ID = /^[a-f0-9]{64}(?![\s\S])/;
const OUTPUT = /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\n?(?![\s\S])/i;

// Pure transcript parsing only: caller-supplied containerId and output are not
// evidence of provenance, freshness, ownership, or permission to mutate.
function parseInternalUuid(expectedContainerId, observation) {
  if (typeof expectedContainerId !== 'string' || !ID.test(expectedContainerId) ||
      !observation || observation.containerId !== expectedContainerId ||
      observation.code !== 0 || observation.stderr !== '' || typeof observation.stdout !== 'string') {
    throw new Error('Internal MySQL UUID observation invalid');
  }
  const match = OUTPUT.exec(observation.stdout);
  if (!match) throw new Error('Internal MySQL UUID observation invalid');
  return match[1].toLowerCase();
}

module.exports = { parseInternalUuid };
