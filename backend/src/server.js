const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "taskboard",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "taskboard"
};

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/*
 * Health check
 */
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "healthy",
      database: "connected"
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      database: "disconnected"
    });
  }
});

/*
 * GET all tasks
 */
app.get("/api/tasks", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, title, completed, created_at FROM tasks ORDER BY id DESC"
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch tasks"
    });
  }
});

/*
 * POST a new task
 */
app.post("/api/tasks", async (req, res) => {
  const { title } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({
      error: "Task title is required"
    });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO tasks (title) VALUES (?)",
      [title.trim()]
    );

    const [rows] = await pool.query(
      "SELECT id, title, completed, created_at FROM tasks WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to create task"
    });
  }
});

/*
 * PATCH task completion status
 */
app.patch("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;

  if (typeof completed !== "boolean") {
    return res.status(400).json({
      error: "completed must be a boolean"
    });
  }

  try {
    const [result] = await pool.query(
      "UPDATE tasks SET completed = ? WHERE id = ?",
      [completed, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Task not found"
      });
    }

    const [rows] = await pool.query(
      "SELECT id, title, completed, created_at FROM tasks WHERE id = ?",
      [id]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to update task"
    });
  }
});

/*
 * DELETE task
 */
app.delete("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      "DELETE FROM tasks WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: "Task not found"
      });
    }

    res.json({
      message: "Task deleted successfully"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to delete task"
    });
  }
});

app.listen(PORT, () => {
  console.log(`TaskBoard backend running on port ${PORT}`);
});
