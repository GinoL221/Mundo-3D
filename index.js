const server = require("./src/app");

//variable de entorno
const PORT = process.env.PORT || 3031;

//Puerto en el que corre el servidor
server.listen(PORT, () => {
  console.log(`El servidor esta corriendo en http://localhost:${PORT}`);
});
