import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

type Env = Record<string, string>

type SpotifyImage = {
  url: string
}

type SpotifyTrackItem = {
  track: {
    id: string | null
    name: string
    duration_ms: number
    explicit: boolean
    preview_url: string | null
    external_urls: {
      spotify: string
    }
    album: {
      name: string
      images: SpotifyImage[]
    }
    artists: Array<{
      name: string
    }>
  } | null
}

type SpotifyPlaylist = {
  id: string
  name: string
  description: string | null
  external_urls: {
    spotify: string
  }
  images: SpotifyImage[]
  owner: {
    display_name: string
  }
  tracks: {
    total: number
  }
}

type SpotifyTracksPage = {
  items: SpotifyTrackItem[]
  total: number
}

class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null

const playlistFields = [
  'id',
  'name',
  'description',
  'external_urls.spotify',
  'images(url)',
  'owner(display_name)',
  'tracks(total)',
].join(',')

const trackFields = [
  'items(track(id,name,duration_ms,explicit,preview_url,external_urls.spotify,album(name,images(url)),artists(name)))',
  'total',
].join(',')

function sendJson(
  response: import('node:http').ServerResponse,
  status: number,
  payload: unknown,
) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

function stripHtml(value: string | null) {
  if (!value) {
    return null
  }

  return value.replace(/<[^>]*>/g, '').trim() || null
}

function hasTrack(item: SpotifyTrackItem): item is SpotifyTrackItem & {
  track: NonNullable<SpotifyTrackItem['track']>
} {
  return item.track !== null
}

async function readSpotifyError(response: Response) {
  try {
    const data = await response.json()
    return data?.error?.message ?? data?.error_description ?? 'Erro na API do Spotify.'
  } catch {
    return 'Erro na API do Spotify.'
  }
}

async function getSpotifyAccessToken(env: Env) {
  const clientId = env.SPOTIFY_CLIENT_ID
  const clientSecret = env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new HttpError(
      500,
      'Configure SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no arquivo .env.local.',
    )
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })

  if (!response.ok) {
    throw new HttpError(response.status, await readSpotifyError(response))
  }

  const data = (await response.json()) as {
    access_token?: string
    expires_in?: number
  }

  if (!data.access_token) {
    throw new HttpError(502, 'Resposta invalida ao autenticar no Spotify.')
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000,
  }

  return cachedToken.accessToken
}

async function fetchSpotify<T>(path: string, accessToken: string) {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new HttpError(response.status, await readSpotifyError(response))
  }

  return (await response.json()) as T
}

async function getPlaylist(env: Env, playlistId: string) {
  const accessToken = await getSpotifyAccessToken(env)
  const playlistParams = new URLSearchParams({ fields: playlistFields })
  const playlist = await fetchSpotify<SpotifyPlaylist>(
    `/playlists/${playlistId}?${playlistParams.toString()}`,
    accessToken,
  )

  const tracks: SpotifyTrackItem[] = []
  const limit = 100

  for (let offset = 0; offset < playlist.tracks.total; offset += limit) {
    const trackParams = new URLSearchParams({
      fields: trackFields,
      limit: String(limit),
      offset: String(offset),
    })
    const page = await fetchSpotify<SpotifyTracksPage>(
      `/playlists/${playlistId}/tracks?${trackParams.toString()}`,
      accessToken,
    )

    tracks.push(...page.items)
  }

  return {
    id: playlist.id,
    name: playlist.name,
    description: stripHtml(playlist.description),
    spotifyUrl: playlist.external_urls.spotify,
    imageUrl: playlist.images[0]?.url ?? null,
    ownerName: playlist.owner.display_name,
    totalTracks: playlist.tracks.total,
    tracks: tracks
      .filter(hasTrack)
      .map(({ track }) => ({
        id: track.id ?? randomUUID(),
        name: track.name,
        durationMs: track.duration_ms,
        explicit: track.explicit,
        previewUrl: track.preview_url,
        spotifyUrl: track.external_urls.spotify,
        album: {
          name: track.album.name,
          imageUrl: track.album.images[0]?.url ?? null,
        },
        artists: track.artists.map((artist) => artist.name),
      })),
  }
}

function spotifyApiPlugin(env: Env): Plugin {
  return {
    name: 'vibesync-spotify-api',
    configureServer(server) {
      server.middlewares.use('/api/spotify/playlist', async (request, response) => {
        if (request.method !== 'GET') {
          sendJson(response, 405, { message: 'Metodo nao permitido.' })
          return
        }

        const playlistId = request.url?.replace(/^\/+/, '').split('?')[0]

        if (!playlistId || !/^[a-zA-Z0-9]{22}$/.test(playlistId)) {
          sendJson(response, 400, { message: 'ID de playlist invalido.' })
          return
        }

        try {
          sendJson(response, 200, await getPlaylist(env, playlistId))
        } catch (error) {
          const status = error instanceof HttpError ? error.status : 500
          const message =
            error instanceof Error
              ? error.message
              : 'Nao foi possivel buscar a playlist.'

          sendJson(response, status, { message })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), spotifyApiPlugin(env)],
  }
})
