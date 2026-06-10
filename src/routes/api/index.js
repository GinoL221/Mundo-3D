const express = require('express');
const apiProductsRouter = require('./products');
const apiUsersRouter = require('./users');

const apiRouter = express.Router();

apiRouter.use(apiProductsRouter);
apiRouter.use(apiUsersRouter);

module.exports = apiRouter;
