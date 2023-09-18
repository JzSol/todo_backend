import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
const { Client } = pg;
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// const dbPassword = process.env.DB_PASSWORD;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

await client.connect();

let todos = [];
app.get('/', async (req, res) => {
  const result = await client.query(`
  SELECT * 
  FROM "LasmaTodo"
  ORDER BY completed ASC, deadline ASC
  `);
  res.send(result.rows);
});

app.get('/todos/:todoId', async (req, res) => {
  const { todoId } = req.params;
  const result = await client.query(
    `
    SELECT * 
    FROM "LasmaTodo"
    WHERE id = $1
  `,
    [todoId]
  );

  if (result.rows.length === 0) {
    res.status(404).send('Todo not found');
    return;
  }

  res.send(result.rows[0]);
});
app.post('/', async (req, res) => {
  const { title, deadline } = req.body;
  const id = uuidv4();

  const addResult = await client.query(
    'INSERT INTO "LasmaTodo" (id, title, deadline) VALUES ($1, $2, $3)',
    [id, title, deadline]
  );

  const newTodo = {
    id,
    title,
    deadline,
    completed: false,
  };

  todos.push(newTodo);
  res.send(newTodo);
});

app.delete('/todos/:todoId', async (req, res) => {
  const { todoId } = req.params;

  const result = await client.query(
    'DELETE FROM "LasmaTodo" WHERE id = $1 RETURNING *',
    [todoId]
  );

  if (result.rows.length === 0) {
    res.status(404).send('Todo not found');
  } else {
    res.send(`Todo with ID ${todoId} deleted successfully`);
  }
});

app.put('/todos/:todoId', async (req, res) => {
  const { todoId } = req.params;
  const { title, completed } = req.body;

  const result = await client.query(
    'UPDATE "LasmaTodo" SET title = $1, completed = $2 WHERE id = $3 RETURNING *',
    [title, completed, todoId]
  );

  if (result.rows.length === 0) {
    res.status(404).send('Todo not found');
  } else {
    res.send(result.rows[0]);
  }
});

app.patch('/todos/:todoId', async (req, res) => {
  const { todoId } = req.params;
  const { title, deadline, info, completed } = req.body;

  const updateFields = [];
  const values = [];

  // Fetch the existing todo
  const existingTodoRes = await client.query(
    'SELECT * FROM "LasmaTodo" WHERE id = $1',
    [todoId]
  );
  const existingTodo = existingTodoRes.rows[0];

  if (title !== undefined) {
    updateFields.push('title = $' + (updateFields.length + 1));
    values.push(title);
  }

  if (deadline !== undefined) {
    updateFields.push('deadline = $' + (updateFields.length + 1));
    values.push(deadline);
  }

  if (info !== undefined) {
    updateFields.push('info = $' + (updateFields.length + 1));
    values.push(info);
  }

  // Use the existing 'completed' status if one is not provided
  const completedStatus =
    completed !== undefined ? completed : existingTodo.completed;
  updateFields.push('completed = $' + (updateFields.length + 1));
  values.push(completedStatus);

  values.push(todoId);

  const query =
    'UPDATE "LasmaTodo" SET ' +
    updateFields.join(', ') +
    ' WHERE id = $' +
    values.length +
    ' RETURNING *';

  const result = await client.query(query, values);

  if (result.rows.length === 0) {
    res.status(404).send('Todo not found');
  } else {
    res.send(result.rows[0]);
  }
});

app.listen(port, () => console.log(`App listening on port ${port}!`));
