require("dotenv").config();
const app = require("./app");

const PORT = Number(process.env.PORT) || 4100;

app.listen(PORT, () => {
    console.log(`Backend iniciado en puerto ${PORT}`);
}).on("error", (err) => {
    console.error("Error al iniciar el servidor:", err);
    process.exit(1);
});