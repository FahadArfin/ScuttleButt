import { useEffect, useMemo, useState } from 'react';

import { Gif, MagnifyingGlass, Plus, Smiley, Sparkle, Sticker } from '@phosphor-icons/react';

export type MediaPickerTab = 'gifs' | 'stickers' | 'emoji';

export interface MediaPickerEmote {
  dataUrl: string;
  id: string;
  name: string;
  sourceGroupName?: string;
}

export interface MediaAsset {
  id: string;
  kind: 'gif' | 'sticker' | 'emoji' | 'custom-emote';
  label: string;
  previewUrl?: string;
  source?: string;
  url?: string;
  value?: string;
}

interface GiphyImage {
  url?: string;
  webp_url?: string;
}

interface GiphyItem {
  id: string;
  images?: {
    fixed_height_small?: GiphyImage;
    fixed_width_small?: GiphyImage;
    original?: GiphyImage;
  };
  title?: string;
  url?: string;
}

interface GiphyResponse {
  data?: GiphyItem[];
}

const POPULAR_EMOJI = [
  '\u2764\uFE0F',
  '\uD83D\uDC4D',
  '\uD83D\uDE02',
  '\uD83D\uDE2D',
  '\uD83D\uDE2E',
  '\uD83D\uDE09',
  '\uD83D\uDE0E',
  '\uD83D\uDE80',
  '\u2728',
  '\uD83C\uDF89',
  '\uD83C\uDFAE',
  '\uD83D\uDC7B',
  '\uD83D\uDC38',
  '\uD83D\uDD25',
  '\uD83D\uDE4F',
  '\uD83D\uDE4C',
  '\uD83E\uDD14',
  '\uD83E\uDD73',
  '\uD83D\uDE21',
  '\uD83D\uDE34',
  '\uD83D\uDC40',
  '\uD83D\uDC4F',
  '\uD83D\uDEAB',
  '\u2705',
  '\u274C',
  '\u2757',
  '\uD83D\uDCAF',
  '\uD83D\uDCA1',
  '\uD83C\uDF1F',
  '\uD83C\uDF89',
  '\uD83C\uDFB5',
  '\uD83C\uDFAC',
  '\uD83D\uDCBB',
  '\uD83D\uDDA5\uFE0F',
  '\uD83D\uDCF8',
  '\uD83C\uDF55',
  '\uD83C\uDF7F',
  '\uD83C\uDF82',
  '\uD83C\uDF89',
  '\uD83E\uDD84',
  '\uD83E\uDD8A',
  '\uD83D\uDC36',
  '\uD83D\uDC31',
  '\uD83D\uDC3C',
  '\uD83E\uDD8B',
  '\uD83C\uDF3B',
  '\uD83C\uDF08',
  '\uD83C\uDF0A',
  '\uD83C\uDF19',
];

const PICKER_TABS: Array<{ id: MediaPickerTab; label: string }> = [
  { id: 'gifs', label: 'GIFs' },
  { id: 'stickers', label: 'Stickers' },
  { id: 'emoji', label: 'Emoji' },
];

function configuredGiphyKey(): string {
  const env = (
    import.meta as ImportMeta & {
      env?: Record<string, string | undefined>;
    }
  ).env;
  return env?.VITE_GIPHY_API_KEY?.trim() ?? '';
}

function giphyImageUrl(image?: GiphyImage): string | undefined {
  return image?.webp_url ?? image?.url;
}

async function searchGiphy(
  tab: Exclude<MediaPickerTab, 'emoji'>,
  query: string,
  signal: AbortSignal,
): Promise<MediaAsset[]> {
  const apiKey = configuredGiphyKey();
  if (!apiKey) return [];

  const contentType = tab === 'stickers' ? 'stickers' : 'gifs';
  const endpoint = query.trim() ? 'search' : 'trending';
  const params = new URLSearchParams({ api_key: apiKey, limit: '24', rating: 'g' });
  if (query.trim()) params.set('q', query.trim().slice(0, 50));
  const response = await fetch(
    `https://api.giphy.com/v1/${contentType}/${endpoint}?${params.toString()}`,
    { signal },
  );
  if (!response.ok) throw new Error(`GIPHY returned ${response.status}.`);
  const payload = (await response.json()) as GiphyResponse;
  return (payload.data ?? [])
    .map((item): MediaAsset | undefined => {
      const url = giphyImageUrl(item.images?.original);
      const previewUrl = giphyImageUrl(
        tab === 'stickers' ? item.images?.fixed_height_small : item.images?.fixed_width_small,
      );
      if (!url) return undefined;
      return {
        id: item.id,
        kind: tab === 'stickers' ? 'sticker' : 'gif',
        label: item.title?.trim() || `${tab === 'stickers' ? 'Sticker' : 'GIF'} from GIPHY`,
        previewUrl: previewUrl ?? url,
        source: 'GIPHY',
        url,
      };
    })
    .filter((asset): asset is MediaAsset => Boolean(asset));
}

function tabIcon(tab: MediaPickerTab) {
  if (tab === 'gifs') return <Gif size={16} weight="bold" />;
  if (tab === 'stickers') return <Sticker size={16} weight="bold" />;
  return <Smiley size={16} weight="bold" />;
}

export function MediaPicker({
  emotes = [],
  initialTab = 'emoji',
  onManageEmoji,
  onSelect,
}: {
  emotes?: MediaPickerEmote[];
  initialTab?: MediaPickerTab;
  onManageEmoji?: () => void;
  onSelect: (asset: MediaAsset) => void;
}) {
  const [tab, setTab] = useState<MediaPickerTab>(initialTab);
  const [query, setQuery] = useState('');
  const [remoteAssets, setRemoteAssets] = useState<MediaAsset[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const hasGiphyKey = Boolean(configuredGiphyKey());

  useEffect(() => {
    if (tab === 'emoji') {
      setRemoteAssets([]);
      setStatus('idle');
      setError('');
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (!hasGiphyKey) {
        setRemoteAssets([]);
        setStatus('idle');
        return;
      }
      setStatus('loading');
      setError('');
      void searchGiphy(tab, query, controller.signal)
        .then((assets) => {
          if (controller.signal.aborted) return;
          setRemoteAssets(assets);
          setStatus('idle');
        })
        .catch((reason) => {
          if (controller.signal.aborted) return;
          setRemoteAssets([]);
          setStatus('error');
          setError(reason instanceof Error ? reason.message : 'Media search failed.');
        });
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [hasGiphyKey, query, tab]);

  const customAssets = useMemo<MediaAsset[]>(
    () =>
      emotes.map((emote) => ({
        id: emote.id,
        kind: 'custom-emote',
        label: `:${emote.name}:`,
        previewUrl: emote.dataUrl,
        source: emote.sourceGroupName ?? 'Server emoji',
        url: emote.dataUrl,
        value: `:${emote.name}:`,
      })),
    [emotes],
  );

  return (
    <div
      className="media-picker"
      data-testid="media-picker"
      role="dialog"
      aria-label="Media picker"
    >
      <div className="media-picker-tabs" role="tablist" aria-label="Choose media type">
        {PICKER_TABS.map((pickerTab) => (
          <button
            type="button"
            className={tab === pickerTab.id ? 'media-picker-tab-active' : ''}
            key={pickerTab.id}
            role="tab"
            aria-selected={tab === pickerTab.id}
            onClick={() => {
              setTab(pickerTab.id);
              setQuery('');
            }}
          >
            {tabIcon(pickerTab.id)} {pickerTab.label}
          </button>
        ))}
      </div>

      <label className="media-picker-search">
        <MagnifyingGlass size={17} />
        <span className="visually-hidden">Search {tab}</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tab === 'emoji' ? 'Search emoji' : `Search ${tab}`}
          type="search"
        />
      </label>

      {tab === 'emoji' ? (
        <div className="media-picker-emoji-content">
          <div className="media-picker-section-heading">
            <span>
              <Sparkle size={15} /> Frequently used
            </span>
            {onManageEmoji ? (
              <button type="button" onClick={onManageEmoji}>
                <Plus size={14} /> Add emoji
              </button>
            ) : null}
          </div>
          <div className="media-picker-emoji-grid" aria-label="Emoji choices">
            {POPULAR_EMOJI.filter((emoji) => !query || emoji.includes(query)).map(
              (emoji, index) => (
                <button
                  type="button"
                  key={`${emoji}-${index}`}
                  className="media-picker-emoji-button"
                  aria-label={`Use ${emoji}`}
                  onClick={() =>
                    onSelect({ id: `emoji-${index}`, kind: 'emoji', label: emoji, value: emoji })
                  }
                >
                  {emoji}
                </button>
              ),
            )}
          </div>
          {customAssets.length ? (
            <>
              <div className="media-picker-section-heading">
                <span>
                  <Smiley size={15} /> From your servers
                </span>
              </div>
              <div className="media-picker-custom-grid" aria-label="Server emoji choices">
                {customAssets
                  .filter(
                    (asset) => !query || asset.label.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((asset) => (
                    <button
                      type="button"
                      key={asset.id}
                      className="media-picker-custom-button"
                      title={`${asset.label} · ${asset.source}`}
                      onClick={() => onSelect(asset)}
                    >
                      <img src={asset.previewUrl} alt={asset.label} />
                    </button>
                  ))}
              </div>
            </>
          ) : null}
        </div>
      ) : status === 'loading' ? (
        <div className="media-picker-empty">
          <Sparkle size={24} />
          <strong>Finding something good…</strong>
          <span>Searching GIPHY for {query || 'trending'}.</span>
        </div>
      ) : status === 'error' ? (
        <div className="media-picker-empty media-picker-empty-error">
          <strong>Media search is unavailable</strong>
          <span>{error}</span>
        </div>
      ) : !hasGiphyKey ? (
        <div className="media-picker-empty">
          {tab === 'gifs' ? <Gif size={26} /> : <Sticker size={26} />}
          <strong>Connect {tab === 'gifs' ? 'GIFs' : 'stickers'}</strong>
          <span>
            Set VITE_GIPHY_API_KEY at build time to search GIPHY. Emoji and server emoji work
            offline.
          </span>
        </div>
      ) : remoteAssets.length ? (
        <div className="media-picker-media-grid" aria-label={`${tab} results`}>
          {remoteAssets.map((asset) => (
            <button
              type="button"
              key={asset.id}
              className="media-picker-media-button"
              title={asset.label}
              onClick={() => onSelect(asset)}
            >
              <img src={asset.previewUrl ?? asset.url} alt={asset.label} loading="lazy" />
            </button>
          ))}
        </div>
      ) : (
        <div className="media-picker-empty">
          {tab === 'gifs' ? <Gif size={26} /> : <Sticker size={26} />}
          <strong>No {tab} found</strong>
          <span>Try another search.</span>
        </div>
      )}

      <div className="media-picker-footer">
        {tab === 'emoji'
          ? 'Unicode and server emoji are available in every conversation.'
          : 'Powered by GIPHY · content filtered to G.'}
      </div>
    </div>
  );
}
