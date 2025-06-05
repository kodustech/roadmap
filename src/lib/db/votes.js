import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'votes.db');

// Inicializa o banco de dados
async function initDB() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Carrega e executa o schema
  const schema = await import('./schema.sql?raw');
  await db.exec(schema.default);

  return db;
}

let db;

// Garante que o banco está inicializado antes de usar
async function getDB() {
  if (!db) {
    db = await initDB();
  }
  return db;
}

export async function addVote(epicKey, userId) {
  const db = await getDB();
  try {
    await db.run(
      'INSERT INTO votes (epic_key, user_id) VALUES (?, ?)',
      [epicKey, userId]
    );
    return true;
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return false; // Usuário já votou
    }
    throw error;
  }
}

export async function removeVote(epicKey, userId) {
  const db = await getDB();
  const result = await db.run(
    'DELETE FROM votes WHERE epic_key = ? AND user_id = ?',
    [epicKey, userId]
  );
  return result.changes > 0;
}

export async function hasVoted(epicKey, userId) {
  const db = await getDB();
  const vote = await db.get(
    'SELECT 1 FROM votes WHERE epic_key = ? AND user_id = ?',
    [epicKey, userId]
  );
  return !!vote;
}

export async function getVoteCount(epicKey) {
  const db = await getDB();
  const result = await db.get(
    'SELECT COUNT(*) as count FROM votes WHERE epic_key = ?',
    [epicKey]
  );
  return result.count;
}

export async function getVotesForEpics(epicKeys) {
  const db = await getDB();
  const placeholders = epicKeys.map(() => '?').join(',');
  const voteCounts = await db.all(
    `SELECT epic_key, COUNT(*) as count 
     FROM votes 
     WHERE epic_key IN (${placeholders})
     GROUP BY epic_key`,
    epicKeys
  );
  
  // Converte para um objeto para fácil acesso
  return voteCounts.reduce((acc, vote) => {
    acc[vote.epic_key] = vote.count;
    return acc;
  }, {});
} 