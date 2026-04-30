import { useMemo, useState, type FormEvent } from 'react'
import './App.css'

type PlaylistTrack = {
  id: string
  name: string
  durationMs: number
  explicit: boolean
  previewUrl: string | null
  spotifyUrl: string
  album: {
    name: string
    imageUrl: string | null
  }
  artists: string[]
}

type PlaylistResult = {
  id: string
  name: string
  description: string | null
  spotifyUrl: string
  imageUrl: string | null
  ownerName: string
  totalTracks: number
  tracks: PlaylistTrack[]
}

type RequestStatus = 'idle' | 'loading' | 'success' | 'error'

const playlistUrlPattern =
  /spotify\.com\/(?:(?:[a-z]{2}|intl-[a-z]{2})\/)?playlist\/([a-zA-Z0-9]+)/
const playlistUriPattern = /^spotify:playlist:([a-zA-Z0-9]+)$/
const playlistIdPattern = /^[a-zA-Z0-9]{22}$/

function extractPlaylistId(value: string) {
  const trimmedValue = value.trim()

  if (playlistIdPattern.test(trimmedValue)) {
    return trimmedValue
  }

  const urlMatch = trimmedValue.match(playlistUrlPattern)
  if (urlMatch?.[1]) {
    return urlMatch[1]
  }

  const uriMatch = trimmedValue.match(playlistUriPattern)
  if (uriMatch?.[1]) {
    return uriMatch[1]
  }

  return null
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')

  return `${minutes}:${seconds}`
}

function App() {
  const [playlistInput, setPlaylistInput] = useState('')
  const [playlist, setPlaylist] = useState<PlaylistResult | null>(null)
  const [status, setStatus] = useState<RequestStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const playlistId = useMemo(() => extractPlaylistId(playlistInput), [playlistInput])
  const canSubmit = status !== 'loading' && playlistInput.trim().length > 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!playlistId) {
      setStatus('error')
      setErrorMessage('Cole um link, URI ou ID valido de playlist do Spotify.')
      return
    }

    setStatus('loading')
    setErrorMessage('')
    setPlaylist(null)

    try {
      const response = await fetch(`/api/spotify/playlist/${playlistId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.message ?? 'Nao foi possivel carregar a playlist.')
      }

      setPlaylist(data)
      setStatus('success')
    } catch (error) {
      setStatus('error')
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Ocorreu um erro inesperado ao buscar a playlist.',
      )
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-section">
        <div className="hero-content">
          <p className="eyebrow">Spotify playlist sync</p>
          <h1>VibeSync</h1>
          <p className="hero-copy">
            Cole o link de uma playlist do Spotify para visualizar todas as
            musicas, artistas, albuns e duracoes em uma lista limpa.
          </p>

          <form className="playlist-form" onSubmit={handleSubmit}>
            <label htmlFor="playlist-url">Link da playlist</label>
            <div className="input-row">
              <input
                id="playlist-url"
                placeholder="https://open.spotify.com/playlist/..."
                value={playlistInput}
                onChange={(event) => setPlaylistInput(event.target.value)}
              />
              <button type="submit" disabled={!canSubmit}>
                {status === 'loading' ? 'Buscando...' : 'Sincronizar'}
              </button>
            </div>
            {playlistInput && !playlistId ? (
              <p className="form-hint error-text">
                O valor informado nao parece ser uma playlist valida.
              </p>
            ) : (
              <p className="form-hint">
                Aceita link completo, URI spotify:playlist ou ID da playlist.
              </p>
            )}
          </form>
        </div>
      </section>

      <section className="results-section" aria-live="polite">
        {status === 'idle' && (
          <div className="empty-state">
            <span>Pronto para sincronizar</span>
            <p>As faixas da playlist aparecem aqui depois da busca.</p>
          </div>
        )}

        {status === 'loading' && (
          <div className="empty-state">
            <span>Carregando playlist</span>
            <p>Buscando dados diretamente na API do Spotify.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="empty-state error-state">
            <span>Falha na sincronizacao</span>
            <p>{errorMessage}</p>
          </div>
        )}

        {playlist && status === 'success' && (
          <div className="playlist-panel">
            <header className="playlist-header">
              {playlist.imageUrl ? (
                <img src={playlist.imageUrl} alt="" className="playlist-cover" />
              ) : (
                <div className="playlist-cover placeholder-cover" />
              )}

              <div>
                <p className="eyebrow">Playlist de {playlist.ownerName}</p>
                <h2>{playlist.name}</h2>
                {playlist.description && (
                  <p className="playlist-description">{playlist.description}</p>
                )}
                <div className="playlist-meta">
                  <span>{playlist.totalTracks} musicas</span>
                  <a href={playlist.spotifyUrl} target="_blank" rel="noreferrer">
                    Abrir no Spotify
                  </a>
                </div>
              </div>
            </header>

            <div className="track-list">
              {playlist.tracks.map((track, index) => (
                <article className="track-item" key={`${track.id}-${index}`}>
                  <span className="track-index">{index + 1}</span>
                  {track.album.imageUrl ? (
                    <img src={track.album.imageUrl} alt="" className="album-cover" />
                  ) : (
                    <div className="album-cover placeholder-cover" />
                  )}
                  <div className="track-info">
                    <a href={track.spotifyUrl} target="_blank" rel="noreferrer">
                      {track.name}
                    </a>
                    <span>
                      {track.artists.join(', ')} - {track.album.name}
                    </span>
                  </div>
                  {track.explicit && <span className="explicit-badge">E</span>}
                  <time>{formatDuration(track.durationMs)}</time>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
