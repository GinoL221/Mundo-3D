'use strict';

const ID = /^[a-f0-9]{64}(?![\s\S])/;

// Pure offline evidence evaluator. Reconciles captured creation output against
// inspection data without invoking Docker or executing destructive cleanup.
function reconcileCreationEvidence(input) {
  const { createdContainerId, inspectedContainer } = input || {};

  const untrustedCandidates = {
    containerIds: [],
    volumeNames: [],
  };

  if (typeof createdContainerId === 'string' && ID.test(createdContainerId)) {
    untrustedCandidates.containerIds.push(createdContainerId);
  }

  if (inspectedContainer && Array.isArray(inspectedContainer.Mounts)) {
    for (const mount of inspectedContainer.Mounts) {
      if (typeof mount?.Name === 'string' && ID.test(mount.Name)) {
        untrustedCandidates.volumeNames.push(mount.Name);
      }
    }
  }

  const failClosed = () => ({
    status: 'uncertain',
    containerId: null,
    volumeName: null,
    cleanupPermitted: false,
    untrustedCandidates: Object.freeze({
      containerIds: Object.freeze([...new Set(untrustedCandidates.containerIds)]),
      volumeNames: Object.freeze([...new Set(untrustedCandidates.volumeNames)]),
    }),
  });

  if (typeof createdContainerId !== 'string' || !ID.test(createdContainerId)) {
    return failClosed();
  }

  if (!inspectedContainer || typeof inspectedContainer !== 'object') {
    return failClosed();
  }

  if (inspectedContainer.Id !== createdContainerId) {
    return failClosed();
  }

  const mounts = inspectedContainer.Mounts;
  if (!Array.isArray(mounts) || mounts.length !== 1) {
    return failClosed();
  }

  const primaryMount = mounts[0];
  if (
    !primaryMount ||
    primaryMount.Type !== 'volume' ||
    primaryMount.Destination !== '/var/lib/mysql' ||
    primaryMount.RW !== true ||
    typeof primaryMount.Name !== 'string' ||
    !ID.test(primaryMount.Name)
  ) {
    return failClosed();
  }

  return Object.freeze({
    status: 'confirmed',
    containerId: createdContainerId,
    volumeName: primaryMount.Name,
  });
}

module.exports = { reconcileCreationEvidence };
