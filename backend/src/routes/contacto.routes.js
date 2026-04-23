const express = require("express");
const { sendContacto } = require("../controllers/contacto.controller");

const router = express.Router();

/* Pública */
router.post("/", sendContacto);

module.exports = router;