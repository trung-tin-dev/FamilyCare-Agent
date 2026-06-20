import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "FamilyCare API is running"
  })
});

app.listen(5000, () => {
  console.log("[FamilyCare API] Server is running on port 5000");
});
