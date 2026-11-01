import type { Sequelize } from 'sequelize';

export function initializeModelsForConnection(sequelize: Sequelize): typeof import('./db');
