const getAllUsers = require("./getAllUsers");
const getUserById = require("./getUserById");
const formNewUser = require("./formNewUser");
const postNewUser = require("./postNewUser");
const deleteUser = require("./deleteUser");
const loginUsers = require("./loginUsers");
const processLogin = require("./processLogin");
const userProfile = require("./userProfile");
const logout = require("./logout");

module.exports = {
  getAllUsers,
  formNewUser,
  postNewUser,
  getUserById,
  deleteUser,
  loginUsers,
  processLogin,
  userProfile,
  logout,
};
