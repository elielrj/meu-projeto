const express = require('express');
const knex = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

const cors = require('cors');
app.use(cors());

app.use(express.json());

const SEGREDO = "minhasecretkey";

// Criar tabelas se não existirem
async function criarTabelas() {
    const existeUsuarios = await knex.schema.hasTable('usuarios');
    if (!existeUsuarios) {
        await knex.schema.createTable('usuarios', table => {
            table.increments('id');
            table.string('nome');
            table.string('email').unique();
            table.string('senha');
        });
    }

    const existeMensagens = await knex.schema.hasTable('mensagens');
    if (!existeMensagens) {
        await knex.schema.createTable('mensagens', table => {
            table.increments('id');
            table.integer('usuario_id').references('id').inTable('usuarios');
            table.text('texto');
            table.timestamp('data_postagem').defaultTo(knex.fn.now());
        });
    }
}

criarTabelas();

// Rota de cadastro com senha criptografada
app.post('/signup', async (req, res) => {
    const { nome, email, senha } = req.body;
    const hash = await bcrypt.hash(senha, 10);
    await knex('usuarios').insert({ nome, email, senha: hash });
    res.status(201).json({ mensagem: "Usuário cadastrado!" });
});

// Rota de login com JWT
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    const usuario = await knex('usuarios').where({ email }).first();
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
        return res.status(401).json({ erro: "Credenciais inválidas" });
    }
    const token = jwt.sign({ id: usuario.id }, SEGREDO);
    res.json({ token });
});

// Middleware para proteger rotas
function autenticar(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ erro: "Token não enviado" });
    try {
        const [, token] = auth.split(" ");
        const payload = jwt.verify(token, SEGREDO);
        req.usuario_id = payload.id;
        next();
    } catch {
        res.status(401).json({ erro: "Token inválido" });
    }
}

// Rota protegida para criar mensagem
app.post('/mensagens', autenticar, async (req, res) => {
    const { texto } = req.body;
    await knex('mensagens').insert({
        usuario_id: req.usuario_id,
        texto
    });
    res.status(201).json({ mensagem: "Mensagem criada" });
});

// Rota pública para listar mensagens
app.get('/mensagens', async (req, res) => {
    const mensagens = await knex('mensagens')
        .join('usuarios', 'usuarios.id', '=', 'mensagens.usuario_id')
        .select('mensagens.id', 'usuarios.nome', 'mensagens.texto', 'mensagens.data_postagem');
    res.json(mensagens);
});

// Inicia o servidor
app.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000');
});
