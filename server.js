const express = require("express");
require("dotenv").config();

const aiRoutes = require("./src/routes/ai");

const app = express();
app.use(express.json());

app.use("/api/ai", aiRoutes);

app.listen(3000, () => console.log("Server running on port 3000"));

app.use(express.static("public"));
