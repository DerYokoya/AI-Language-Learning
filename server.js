const express = require("express");
require("dotenv").config();

const aiRoutes = require("./src/routes/ai");

const app = express();
app.use(express.json());

app.use("/api/ai", aiRoutes);

app.use(express.static("public"));

app.get("/index", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Redirect so it shows index instead of index.html
app.get("/index.html", (req, res) => {
  res.redirect("/index");
});

app.listen(3000, () => console.log("Server running on port 3000"));