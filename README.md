# VibeSync

VibeSync e um webapp em React que recebe o link de uma playlist do Spotify,
consulta a API oficial e lista as musicas encontradas com artista, album,
capa e duracao.

## Stack

- React 19
- TypeScript
- Vite
- Spotify Web API

## Como configurar

1. Copie o arquivo de exemplo:

```powershell
Copy-Item .env.example .env.local
```

2. Preencha as credenciais do Spotify:

```env
SPOTIFY_CLIENT_ID=seu_client_id
SPOTIFY_CLIENT_SECRET=seu_client_secret
```

3. Rode o projeto quando quiser testar localmente:

```powershell
npm run dev
```

## Como funciona

- O React extrai o ID da playlist a partir de link, URI ou ID puro.
- O frontend chama `/api/spotify/playlist/:playlistId`.
- O middleware local em `vite.config.ts` usa Client Credentials Flow para obter
  token no Spotify.
- As faixas sao buscadas em paginas de 100 itens ate carregar a playlist
  completa.

## Seguranca

O `client_secret` nunca deve ser usado diretamente no browser. Por isso, esta
primeira versao mantem a chamada ao Spotify no middleware local do Vite.

Importante: se uma credencial foi enviada em chat, issue, commit ou qualquer
lugar publico, gere um novo `client_secret` no painel do Spotify Developer.

## Proximo passo recomendado

Para producao, mova a rota `/api/spotify/playlist/:playlistId` para um backend
ou funcao serverless. O Vite middleware e bom para desenvolvimento local, mas
nao substitui uma API de producao.
